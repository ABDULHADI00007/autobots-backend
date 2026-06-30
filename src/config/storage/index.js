// ============================================================
// STORAGE INDEX — PUBLIC API
//
// This is the ONLY file any business module may import.
//
// Usage:
//   import { storage } from "../config/storage/index.js";
//
//   const result = await storage.upload.buffer({ ... });
//   const url    = await storage.download.signedUrl(key);
//   const auth   = await storage.download.authorizedSignedUrl(key, userId, role);
//   await storage.delete.one(key);
//   await storage.delete.many([key1, key2]);
//   const result = await storage.replace({ ... });
//   const ok     = await storage.authorize.check(key, userId, role);
//
// No business module may:
//   - import @aws-sdk directly
//   - import storage.service.js directly
//   - import storage.client.js directly
//   - import storage.engine.js directly
//   - construct upload metadata manually
//   - generate presigned URLs without going through storage.download
// ============================================================

// ============================================================
// ENGINE IMPORTS
// ============================================================

import {
  uploadBuffer,
  uploadStream,
  uploadMultipart,
  deleteSingleObject,
  deleteMultipleObjects,
  getObjectMetadata,
  replaceObject,
  withTransactionSafety,
} from "./storage.engine.js";

import {
  createSignedDownloadUrl,
  createSignedDownloadUrlIfExists,
  createMultipleSignedUrls,
  createAuthorizedSignedUrl,
  createMultipleAuthorizedSignedUrls,
  logDownloadEvent,
  logPreviewEvent,
  SIGNED_URL_EXPIRY,
} from "./storage.download.js";

import {
  assertStorageAccess,
  checkStorageAccess,
  isFolderPublic,
  isFolderPrivate,
  isKeyPrivate,
  folderFromKey,
  StorageAuthorizationError,
} from "./storage.authorization.js";

import {
  createLifecycleRecord,
  softDeleteRecord,
  archiveRecord,
  retentionDaysForFolder,
  computeExpiresAt,
  isRetentionExpired,
  getRecordsDueForDeletion,
  groupByFolder,
  findOrphanKeys,
  findBrokenReferences,
  LIFECYCLE_STATUS,
  RETENTION_DAYS,
} from "./storage.lifecycle.js";

import {
  verifyStorageKeys,
  verifyDocumentStorageKeys,
  formatIntegritySummary,
} from "./storage.integrity.js";

// ============================================================
// RE-EXPORTS — helpers business modules may need
// ============================================================

export { STORAGE_FOLDERS, PUBLIC_STORAGE_FOLDERS, PRIVATE_STORAGE_FOLDERS, isPublicFolder, isPrivateFolder } from "./storage.helpers.js";
export { SIGNED_URL_EXPIRY } from "./storage.download.js";
export {
  ALLOWED_MIME_TYPES,
  ALL_ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  SIZE_LIMITS,
  validateFile,
  validateMimeType,
  validateMimeTypeFormat,
  validateExtension,
  validateFileSize,
  validateNotEmpty,
} from "./storage.validation.js";
export {
  StorageError,
  StorageConfigError,
  StorageUploadError,
  StorageDeleteError,
  StorageNotFoundError,
  StorageValidationError,
  StorageBucketError,
} from "./storage.errors.js";
export { StorageAuthorizationError } from "./storage.authorization.js";
export { LIFECYCLE_STATUS, RETENTION_DAYS } from "./storage.lifecycle.js";

// ============================================================
// STORAGE FACADE
// The single object every business module uses.
// ============================================================

export const storage = Object.freeze({

  // --------------------------------------------------------
  // UPLOAD
  // --------------------------------------------------------
  upload: Object.freeze({
    /**
     * Upload a Buffer.
     * @param {{ folder, buffer, mimeType, fileName, metadata?, constraints? }} opts
     * @returns {Promise<UploadResult>}
     */
    buffer: uploadBuffer,

    /**
     * Upload a Readable stream (memory-efficient for large files).
     * @param {{ folder, stream, mimeType, fileName, sizeBytes, metadata?, constraints? }} opts
     * @returns {Promise<UploadResult>}
     */
    stream: uploadStream,

    /**
     * Upload with explicit multipart intent (Buffer or Stream).
     * @param {{ folder, body, mimeType, fileName, sizeBytes, metadata?, constraints? }} opts
     * @returns {Promise<UploadResult>}
     */
    multipart: uploadMultipart,
  }),

  // --------------------------------------------------------
  // DOWNLOAD / SIGNED URLS
  // --------------------------------------------------------
  download: Object.freeze({
    /**
     * Generate a presigned GET URL (no auth check — internal use).
     * @param {string} key
     * @param {number} [expiresInSeconds=3600]
     * @returns {Promise<SignedUrlResult>}
     */
    signedUrl: createSignedDownloadUrl,

    /**
     * Generate a presigned URL only if the object exists; null otherwise.
     * @param {string} key
     * @param {number} [expiresInSeconds]
     * @returns {Promise<SignedUrlResult|null>}
     */
    signedUrlIfExists: createSignedDownloadUrlIfExists,

    /**
     * Generate presigned URLs for multiple keys in parallel (no auth — internal).
     * @param {string[]} keys
     * @param {number}   [expiresInSeconds]
     * @returns {Promise<Array<SignedUrlResult|null>>}
     */
    manySignedUrls: createMultipleSignedUrls,

    /**
     * Generate a presigned URL after verifying user authorization.
     * RECOMMENDED for controller-level calls.
     * @param {string} key
     * @param {string} userId
     * @param {string} role
     * @param {number} [expiresInSeconds]
     * @returns {Promise<SignedUrlResult>}
     * @throws {StorageAuthorizationError} if the user is not authorized
     */
    authorizedSignedUrl: createAuthorizedSignedUrl,

    /**
     * Generate authorized signed URLs for multiple keys in parallel.
     * Returns null for keys the user cannot access.
     * @param {string[]} keys
     * @param {string}   userId
     * @param {string}   role
     * @param {number}   [expiresInSeconds]
     * @returns {Promise<Array<SignedUrlResult|null>>}
     */
    manyAuthorizedSignedUrls: createMultipleAuthorizedSignedUrls,

    /**
     * Log a file download event (key + actor only — never the URL).
     * @param {string} key
     * @param {string|null} [userId]
     */
    logDownload: logDownloadEvent,

    /**
     * Log a file preview event.
     * @param {string} key
     * @param {string|null} [userId]
     */
    logPreview: logPreviewEvent,
  }),

  // --------------------------------------------------------
  // DELETE
  // --------------------------------------------------------
  delete: Object.freeze({
    /**
     * Delete a single object.
     * @param {string} key
     * @returns {Promise<{ deleted: true, key: string }>}
     */
    one: deleteSingleObject,

    /**
     * Delete multiple objects in parallel. Reports per-key results.
     * @param {string[]} keys
     * @returns {Promise<BulkDeleteResult>}
     */
    many: deleteMultipleObjects,
  }),

  // --------------------------------------------------------
  // METADATA
  // --------------------------------------------------------
  /**
   * Fetch standardized metadata for an existing object.
   * @param {string} key
   * @returns {Promise<ObjectMetadata>}
   */
  metadata: getObjectMetadata,

  // --------------------------------------------------------
  // REPLACE (atomic: upload → DB update → delete old)
  // --------------------------------------------------------
  /**
   * Atomically replace a stored object.
   * @param {{ folder, body, mimeType, fileName, sizeBytes, previousKey, dbUpdateFn, metadata?, constraints? }} opts
   * @returns {Promise<UploadResult>}
   */
  replace: replaceObject,

  // --------------------------------------------------------
  // TRANSACTION SAFETY (standalone wrapper)
  // --------------------------------------------------------
  /**
   * Wraps an upload result + DB write.
   * Deletes the uploaded object automatically if the DB write fails.
   * @param {UploadResult} uploadResult
   * @param {Function}     dbFn
   * @returns {Promise<UploadResult>}
   */
  withTransactionSafety,

  // --------------------------------------------------------
  // AUTHORIZATION
  // --------------------------------------------------------
  authorize: Object.freeze({
    /**
     * Assert the user can access a file. Throws StorageAuthorizationError on denial.
     * @param {string} key
     * @param {string} userId
     * @param {string} role
     */
    assert: assertStorageAccess,

    /**
     * Returns true if the user can access the file, false otherwise.
     * @param {string} key
     * @param {string} userId
     * @param {string} role
     * @returns {Promise<boolean>}
     */
    check: checkStorageAccess,

    /** Returns true if the folder holds public files. */
    isFolderPublic,

    /** Returns true if the folder holds private files. */
    isFolderPrivate,

    /** Returns true if the key belongs to a private folder. */
    isKeyPrivate,

    /** Extracts the folder prefix from a storage key. */
    folderFromKey,
  }),

  // --------------------------------------------------------
  // LIFECYCLE
  // --------------------------------------------------------
  lifecycle: Object.freeze({
    /** Create a lifecycle record for a storage object. */
    createRecord:           createLifecycleRecord,

    /** Mark a record as soft-deleted (does NOT delete from S3). */
    softDelete:             softDeleteRecord,

    /** Mark a record as archived (future: triggers tier transition). */
    archive:                archiveRecord,

    /** Returns the default retention period in days for a folder. */
    retentionDaysForFolder,

    /** Computes the expiration date for a folder + creation time. */
    computeExpiresAt,

    /** Returns true if a lifecycle record has passed its retention deadline. */
    isExpired:              isRetentionExpired,

    /** Filters records down to those eligible for deletion. */
    getDueForDeletion:      getRecordsDueForDeletion,

    /** Groups records by folder. */
    groupByFolder,

    /** Finds keys present in storage but not in DB (orphans). */
    findOrphans:            findOrphanKeys,

    /** Finds keys in DB that have no corresponding S3 object (broken refs). */
    findBrokenRefs:         findBrokenReferences,
  }),

  // --------------------------------------------------------
  // INTEGRITY
  // --------------------------------------------------------
  integrity: Object.freeze({
    /**
     * Verify a flat list of storage keys against S3.
     * @param {string[]} keys
     * @returns {Promise<IntegrityResult>}
     */
    verifyKeys: verifyStorageKeys,

    /**
     * Verify storage keys referenced by a list of DB documents.
     * @param {object[]} documents
     * @param {string[]} keyFields
     * @param {string}   [label]
     * @returns {Promise<IntegrityResult>}
     */
    verifyDocuments: verifyDocumentStorageKeys,

    /**
     * Format an IntegrityResult as a production-safe log string.
     * @param {IntegrityResult} result
     * @param {string} [context]
     * @returns {string}
     */
    formatSummary: formatIntegritySummary,
  }),
});
