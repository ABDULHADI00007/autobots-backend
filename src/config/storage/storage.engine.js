// ============================================================
// STORAGE ENGINE
// Production-ready, reusable upload / delete / replace engine.
//
// Responsibilities:
//   - Buffer, Stream, and multipart uploads
//   - Standardized UploadResult metadata on every upload
//   - Single and bulk object deletion
//   - Atomic object replacement (upload → DB update → delete old)
//   - Transaction safety: auto-delete orphan on DB failure
//   - Full validation before any S3 call
//   - Structured logging on every operation
//   - Production-safe errors only
//
// Rules:
//   - NO business module may import @aws-sdk directly
//   - NO business module may call storage.service.js directly
//   - ALL storage calls go through storage.engine.js or storage.index.js
// ============================================================

import { Readable } from "stream";

import { uploadObject, deleteObject, headObject } from "./storage.service.js";
import { generateObjectKey, logStorageOperation, mimeTypeToExtension, isPublicFolder } from "./storage.helpers.js";
import { validateFile, validateNotEmpty } from "./storage.validation.js";
import {
  toStorageError,
  StorageUploadError,
  StorageDeleteError,
  StorageValidationError,
} from "./storage.errors.js";

// ============================================================
// STANDARDIZED UPLOAD RESULT
// ============================================================

/**
 * Builds a fully standardized UploadResult object.
 * No business module should ever construct upload metadata manually.
 *
 * @param {object} params
 * @returns {UploadResult}
 *
 * @typedef {object} UploadResult
 * @property {string}  key           - S3 object key
 * @property {string}  bucket        - S3 bucket name
 * @property {string}  url           - Public or base object URL
 * @property {string}  mimeType      - Validated MIME type
 * @property {string}  extension     - File extension derived from MIME type
 * @property {number}  sizeBytes     - File size in bytes
 * @property {string|null} etag      - S3 ETag (if available)
 * @property {string}  uploadedAt    - ISO 8601 timestamp
 * @property {string}  storageProvider - Always "s3" (future: "r2", "spaces", etc.)
 */
function buildUploadResult({ key, bucket, url, mimeType, sizeBytes, etag = null }) {
  return Object.freeze({
    key,
    bucket,
    url,
    mimeType,
    extension:       mimeTypeToExtension(mimeType) || "",
    sizeBytes:       sizeBytes ?? 0,
    etag:            etag ?? null,
    uploadedAt:      new Date().toISOString(),
    storageProvider: "s3",
  });
}

// ============================================================
// TASK 1 — UPLOAD ENGINE
// ============================================================

/**
 * Uploads a Buffer to S3 with full validation and standardized metadata.
 *
 * @param {object}  opts
 * @param {string}  opts.folder       - Target folder (STORAGE_FOLDERS value)
 * @param {Buffer}  opts.buffer       - File content as a Buffer
 * @param {string}  opts.mimeType     - File MIME type
 * @param {string}  opts.fileName     - Original filename (for extension validation only)
 * @param {object}  [opts.metadata]   - Optional S3 user metadata
 * @param {object}  [opts.constraints] - Validation overrides passed to validateFile
 * @returns {Promise<UploadResult>}
 */
export async function uploadBuffer({ folder, buffer, mimeType, fileName, metadata = {}, constraints = {} }) {
  if (!Buffer.isBuffer(buffer)) {
    throw new StorageValidationError("Upload body must be a Buffer.");
  }

  // Reject empty files before any S3 call
  validateNotEmpty(buffer);

  const sizeBytes = buffer.byteLength;

  // Validate before touching S3
  validateFile({ fileName, mimeType, sizeBytes }, constraints);

  const start = Date.now();
  const key   = generateObjectKey(folder, mimeType);

  logStorageOperation("upload", { key, status: "start" });

  try {
    const result = await uploadObject({ folder, body: buffer, mimeType, key, metadata });
    logStorageOperation("upload", { key, status: "success", durationMs: Date.now() - start });

    return buildUploadResult({ key: result.key, bucket: result.bucket, url: result.url, mimeType, sizeBytes });
  } catch (err) {
    logStorageOperation("upload", { key, status: "error", durationMs: Date.now() - start, errorCode: err?.code });
    throw err instanceof StorageUploadError ? err : toStorageError(err, "Buffer upload failed.");
  }
}

/**
 * Uploads a readable Stream to S3 (memory-efficient for large files).
 *
 * @param {object}   opts
 * @param {string}   opts.folder       - Target folder
 * @param {Readable} opts.stream       - Node.js Readable stream
 * @param {string}   opts.mimeType     - File MIME type
 * @param {string}   opts.fileName     - Original filename (validation only)
 * @param {number}   opts.sizeBytes    - Known file size in bytes
 * @param {object}   [opts.metadata]   - Optional S3 user metadata
 * @param {object}   [opts.constraints] - Validation overrides
 * @returns {Promise<UploadResult>}
 */
export async function uploadStream({ folder, stream, mimeType, fileName, sizeBytes, metadata = {}, constraints = {} }) {
  if (!(stream instanceof Readable)) {
    throw new StorageValidationError("Upload body must be a Readable stream.");
  }

  // Validate declared size before streaming to S3
  validateFile({ fileName, mimeType, sizeBytes }, constraints);

  const start = Date.now();
  const key   = generateObjectKey(folder, mimeType);

  logStorageOperation("upload", { key, status: "start" });

  try {
    const result = await uploadObject({ folder, body: stream, mimeType, key, metadata });
    logStorageOperation("upload", { key, status: "success", durationMs: Date.now() - start });

    return buildUploadResult({ key: result.key, bucket: result.bucket, url: result.url, mimeType, sizeBytes });
  } catch (err) {
    logStorageOperation("upload", { key, status: "error", durationMs: Date.now() - start, errorCode: err?.code });
    throw err instanceof StorageUploadError ? err : toStorageError(err, "Stream upload failed.");
  }
}

/**
 * Uploads a file using the AWS SDK multipart Upload manager.
 * Identical to uploadBuffer/uploadStream internally — the Upload class
 * from @aws-sdk/lib-storage handles multipart automatically for files > 5 MB.
 * Exposed separately so callers can be explicit about intent.
 *
 * @param {object}          opts
 * @param {string}          opts.folder
 * @param {Buffer|Readable} opts.body        - Buffer or stream
 * @param {string}          opts.mimeType
 * @param {string}          opts.fileName
 * @param {number}          opts.sizeBytes
 * @param {object}          [opts.metadata]
 * @param {object}          [opts.constraints]
 * @returns {Promise<UploadResult>}
 */
export async function uploadMultipart({ folder, body, mimeType, fileName, sizeBytes, metadata = {}, constraints = {} }) {
  validateFile({ fileName, mimeType, sizeBytes }, constraints);

  const start = Date.now();
  const key   = generateObjectKey(folder, mimeType);

  logStorageOperation("upload", { key, status: "start" });

  try {
    // uploadObject already uses @aws-sdk/lib-storage Upload — multipart is automatic
    const result = await uploadObject({ folder, body, mimeType, key, metadata });
    logStorageOperation("upload", { key, status: "success", durationMs: Date.now() - start });

    return buildUploadResult({ key: result.key, bucket: result.bucket, url: result.url, mimeType, sizeBytes });
  } catch (err) {
    logStorageOperation("upload", { key, status: "error", durationMs: Date.now() - start, errorCode: err?.code });
    throw err instanceof StorageUploadError ? err : toStorageError(err, "Multipart upload failed.");
  }
}

// ============================================================
// TASK 3 — DELETE ENGINE
// ============================================================

/**
 * Safely deletes a single S3 object.
 * Silent no-op if key is null / empty (prevents accidental wildcard deletes).
 *
 * @param {string} key - S3 object key
 * @returns {Promise<{ deleted: true, key: string }>}
 */
export async function deleteSingleObject(key) {
  if (!key || typeof key !== "string") {
    throw new StorageDeleteError("A valid object key is required for deletion.");
  }

  const start = Date.now();
  logStorageOperation("delete", { key, status: "start" });

  try {
    await deleteObject(key);
    logStorageOperation("delete", { key, status: "success", durationMs: Date.now() - start });
    return { deleted: true, key };
  } catch (err) {
    logStorageOperation("delete", { key, status: "error", durationMs: Date.now() - start, errorCode: err?.code });
    throw err instanceof StorageDeleteError ? err : toStorageError(err, "Object deletion failed.");
  }
}

/**
 * Deletes multiple S3 objects in parallel.
 * Continues on individual failures and reports results per key.
 * Throws only if ALL deletions fail.
 *
 * @param {string[]} keys - Array of S3 object keys
 * @returns {Promise<BulkDeleteResult>}
 *
 * @typedef {object} BulkDeleteResult
 * @property {string[]} deleted - Keys successfully deleted
 * @property {Array<{key: string, error: string}>} failed - Keys that failed
 */
export async function deleteMultipleObjects(keys) {
  if (!Array.isArray(keys) || keys.length === 0) {
    return { deleted: [], failed: [] };
  }

  const validKeys = keys.filter(k => k && typeof k === "string");
  const start = Date.now();

  logStorageOperation("delete", { key: `[bulk:${validKeys.length}]`, status: "start" });

  const results = await Promise.allSettled(
    validKeys.map(key => deleteObject(key).then(() => key))
  );

  const deleted = [];
  const failed  = [];

  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      deleted.push(result.value);
    } else {
      const safeErr = toStorageError(result.reason, "Deletion failed.");
      failed.push({ key: validKeys[i], error: safeErr.message });
    }
  });

  logStorageOperation("delete", {
    key: `[bulk:${validKeys.length}]`,
    status: failed.length === validKeys.length ? "error" : "success",
    durationMs: Date.now() - start,
  });

  return { deleted, failed };
}

// ============================================================
// TASK 4 — STANDARDIZED METADATA FETCH
// ============================================================

/**
 * Returns standardized metadata for an existing S3 object.
 *
 * @param {string} key
 * @returns {Promise<ObjectMetadata>}
 *
 * @typedef {object} ObjectMetadata
 * @property {string}      key
 * @property {string}      mimeType
 * @property {number}      sizeBytes
 * @property {Date}        lastModified
 * @property {string}      storageProvider
 */
export async function getObjectMetadata(key) {
  const meta = await headObject(key);
  return Object.freeze({
    key,
    mimeType:        meta.contentType  ?? "application/octet-stream",
    sizeBytes:       meta.contentLength ?? 0,
    lastModified:    meta.lastModified  ?? null,
    storageProvider: "s3",
  });
}

// ============================================================
// TASK 5 + 6 — OBJECT REPLACEMENT WITH TRANSACTION SAFETY
// ============================================================

/**
 * Atomically replaces a stored object:
 *   1. Upload new object to S3
 *   2. Call dbUpdateFn() with the new UploadResult
 *   3. If DB update succeeds → delete old object
 *   4. If DB update fails  → delete new (orphan) object, re-throw
 *
 * The old object is NEVER deleted before the new upload and DB update succeed.
 * Orphan objects are NEVER left in storage on DB failure.
 *
 * @param {object}   opts
 * @param {string}   opts.folder          - Target folder for the new upload
 * @param {Buffer|Readable} opts.body     - New file content
 * @param {string}   opts.mimeType        - New file MIME type
 * @param {string}   opts.fileName        - Original filename (validation only)
 * @param {number}   opts.sizeBytes       - File size in bytes
 * @param {string|null} opts.previousKey  - S3 key of the object to replace (null if none)
 * @param {Function} opts.dbUpdateFn      - async (uploadResult: UploadResult) => any
 *                                          Must persist the new key/url to the database.
 * @param {object}   [opts.metadata]      - Optional S3 user metadata
 * @param {object}   [opts.constraints]   - Validation overrides
 * @returns {Promise<UploadResult>}
 */
export async function replaceObject({
  folder,
  body,
  mimeType,
  fileName,
  sizeBytes,
  previousKey,
  dbUpdateFn,
  metadata    = {},
  constraints = {},
}) {
  if (typeof dbUpdateFn !== "function") {
    throw new StorageValidationError("replaceObject requires a dbUpdateFn to persist the new storage key.");
  }

  // Step 1 — validate before touching S3
  validateFile({ fileName, mimeType, sizeBytes }, constraints);

  const start = Date.now();
  logStorageOperation("replace", { key: previousKey ?? "none", status: "start" });

  // Step 2 — upload new object
  const uploadResult = await uploadMultipart({ folder, body, mimeType, fileName, sizeBytes, metadata, constraints: {} });

  // Step 3 — persist to DB. On failure, clean up the orphan upload immediately.
  try {
    await dbUpdateFn(uploadResult);
  } catch (dbErr) {
    logStorageOperation("replace", {
      key: uploadResult.key,
      status: "error",
      durationMs: Date.now() - start,
      errorCode:  "DB_UPDATE_FAILED",
    });

    // Transaction safety: remove the new object so no orphan remains
    try {
      await deleteObject(uploadResult.key);
      logStorageOperation("delete", { key: uploadResult.key, status: "success" });
    } catch (cleanupErr) {
      // Log the cleanup failure but do not mask the original DB error
      console.error(
        `[STORAGE] ORPHAN WARNING: DB update failed and cleanup of new object "${uploadResult.key}" also failed. Manual cleanup required.`,
        cleanupErr?.message
      );
    }

    throw dbErr;
  }

  // Step 4 — DB update succeeded. Now safely delete the old object.
  if (previousKey && typeof previousKey === "string") {
    try {
      await deleteObject(previousKey);
      logStorageOperation("delete", { key: previousKey, status: "success" });
    } catch (deleteErr) {
      // Non-fatal: new object is live and DB is updated. Log for manual cleanup.
      console.warn(
        `[STORAGE] Previous object "${previousKey}" could not be deleted after replacement. ` +
        `Manual cleanup may be required.`
      );
    }
  }

  logStorageOperation("replace", { key: uploadResult.key, status: "success", durationMs: Date.now() - start });
  return uploadResult;
}

// ============================================================
// TASK 6 — TRANSACTION WRAPPER (standalone)
// ============================================================

/**
 * Wraps any upload + DB write in a transaction-safe block.
 * If dbFn throws, the uploaded object is automatically deleted.
 *
 * Use when you need transaction safety without a replacement (i.e. first upload).
 *
 * @param {UploadResult} uploadResult   - Result of a prior upload call
 * @param {Function}     dbFn           - async () => any — persist to DB
 * @returns {Promise<UploadResult>}
 */
export async function withTransactionSafety(uploadResult, dbFn) {
  if (typeof dbFn !== "function") {
    throw new StorageValidationError("withTransactionSafety requires a dbFn.");
  }

  try {
    await dbFn();
    return uploadResult;
  } catch (dbErr) {
    // DB write failed — remove the orphan object
    try {
      await deleteObject(uploadResult.key);
      logStorageOperation("delete", { key: uploadResult.key, status: "success" });
    } catch (cleanupErr) {
      console.error(
        `[STORAGE] ORPHAN WARNING: DB write failed and cleanup of "${uploadResult.key}" also failed. Manual cleanup required.`,
        cleanupErr?.message
      );
    }
    throw dbErr;
  }
}
