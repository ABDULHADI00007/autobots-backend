// ============================================================
// STORAGE SERVICE
// The single, reusable interface for all S3 operations.
// No other module may import @aws-sdk directly.
// Provider-agnostic: swap S3 for R2, Spaces, MinIO, etc.
// by replacing this service without touching business modules.
// ============================================================

import {
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getS3Client, getS3Bucket } from "./storage.client.js";
import { generateObjectKey, logStorageOperation } from "./storage.helpers.js";
import { toStorageError, StorageNotFoundError } from "./storage.errors.js";
import { env } from "../env.js";

// ============================================================
// UPLOAD
// ============================================================

/**
 * Uploads a file Buffer or Stream to S3.
 *
 * @param {object}          opts
 * @param {string}          opts.folder      - Target folder (from STORAGE_FOLDERS)
 * @param {Buffer|Readable} opts.body        - File content
 * @param {string}          opts.mimeType    - Content-Type header
 * @param {string}          [opts.key]       - Override auto-generated key
 * @param {object}          [opts.metadata]  - Optional S3 object metadata
 * @returns {Promise<{ key: string, url: string, bucket: string }>}
 */
export async function uploadObject({ folder, body, mimeType, key, metadata = {} }) {
  const bucket = getS3Bucket();
  const client = getS3Client();
  const objectKey = key ?? generateObjectKey(folder, mimeType);
  const start = Date.now();

  logStorageOperation("upload", { bucket, key: objectKey, status: "start" });

  try {
    // Use multipart Upload for reliable large-file handling
    const uploader = new Upload({
      client,
      params: {
        Bucket:      bucket,
        Key:         objectKey,
        Body:        body,
        ContentType: mimeType,
        Metadata:    metadata,
      },
    });

    await uploader.done();

    const url = buildObjectUrl(bucket, objectKey);
    logStorageOperation("upload", { bucket, key: objectKey, status: "success", durationMs: Date.now() - start });

    return { key: objectKey, url, bucket };
  } catch (err) {
    logStorageOperation("upload", { bucket, key: objectKey, status: "error", durationMs: Date.now() - start, errorCode: err?.Code || err?.code });
    throw toStorageError(err, "Failed to upload file.");
  }
}

// ============================================================
// DELETE
// ============================================================

/**
 * Deletes an object from S3 by key.
 *
 * @param {string} key - The S3 object key
 * @returns {Promise<void>}
 */
export async function deleteObject(key) {
  const bucket = getS3Bucket();
  const client = getS3Client();
  const start = Date.now();

  logStorageOperation("delete", { bucket, key, status: "start" });

  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    logStorageOperation("delete", { bucket, key, status: "success", durationMs: Date.now() - start });
  } catch (err) {
    logStorageOperation("delete", { bucket, key, status: "error", durationMs: Date.now() - start, errorCode: err?.Code || err?.code });
    throw toStorageError(err, "Failed to delete file.");
  }
}

// ============================================================
// HEAD (metadata only)
// ============================================================

/**
 * Fetches object metadata without downloading the body.
 *
 * @param {string} key
 * @returns {Promise<{ contentType: string, contentLength: number, lastModified: Date }>}
 */
export async function headObject(key) {
  const bucket = getS3Bucket();
  const client = getS3Client();
  const start = Date.now();

  logStorageOperation("head", { bucket, key, status: "start" });

  try {
    const result = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    logStorageOperation("head", { bucket, key, status: "success", durationMs: Date.now() - start });

    return {
      contentType:   result.ContentType,
      contentLength: result.ContentLength,
      lastModified:  result.LastModified,
    };
  } catch (err) {
    const code = err?.Code || err?.code || err?.name;
    logStorageOperation("head", { bucket, key, status: "error", durationMs: Date.now() - start, errorCode: code });

    if (code === "NotFound" || code === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) {
      throw new StorageNotFoundError("Object not found.");
    }
    throw toStorageError(err, "Failed to retrieve file metadata.");
  }
}

// ============================================================
// EXISTS
// ============================================================

/**
 * Returns true if an object exists in the bucket, false otherwise.
 *
 * @param {string} key
 * @returns {Promise<boolean>}
 */
export async function objectExists(key) {
  try {
    await headObject(key);
    return true;
  } catch (err) {
    if (err?.code === "STORAGE_NOT_FOUND") return false;
    throw err;
  }
}

// ============================================================
// GENERATE SIGNED URL
// ============================================================

/**
 * Generates a temporary presigned GET URL for private objects.
 * The URL itself is never logged.
 *
 * @param {string} key
 * @param {number} [expiresInSeconds=3600] - Default: 1 hour
 * @returns {Promise<string>}
 */
export async function generateSignedUrl(key, expiresInSeconds = 3600) {
  const bucket = getS3Bucket();
  const client = getS3Client();
  const start = Date.now();

  logStorageOperation("signedUrl", { bucket, key, status: "start" });

  try {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    // URL is intentionally NOT logged — it contains embedded credentials
    const url = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
    logStorageOperation("signedUrl", { bucket, key, status: "success", durationMs: Date.now() - start });
    return url;
  } catch (err) {
    logStorageOperation("signedUrl", { bucket, key, status: "error", durationMs: Date.now() - start, errorCode: err?.Code || err?.code });
    throw toStorageError(err, "Failed to generate signed URL.");
  }
}

// ============================================================
// KEY GENERATOR (re-exported for convenience)
// ============================================================

export { generateObjectKey } from "./storage.helpers.js";

// ============================================================
// INTERNAL HELPERS
// ============================================================

/**
 * Builds the public object URL.
 * For S3-compatible providers with a custom endpoint, uses that base.
 */
function buildObjectUrl(bucket, key) {
  if (env.AWS_S3_ENDPOINT) {
    const base = env.AWS_S3_ENDPOINT.replace(/\/$/, "");
    return env.AWS_S3_FORCE_PATH_STYLE
      ? `${base}/${bucket}/${key}`
      : `${base}/${key}`;
  }
  return `https://${bucket}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
}
