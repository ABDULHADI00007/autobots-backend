// ============================================================
// STORAGE HELPERS
// Reusable utilities: key generation and operation logging.
// ============================================================

import { randomUUID } from "crypto";
import path from "path";

// ============================================================
// ALLOWED STORAGE FOLDERS
// ============================================================

export const STORAGE_FOLDERS = Object.freeze({
  AVATARS:              "avatars",
  SELLER_LOGOS:         "seller-logos",
  LISTINGS:             "listings",
  SELLER_APPLICATIONS:  "seller-applications",
  DELIVERIES:           "deliveries",
  REVIEWS:              "reviews",
  MESSAGES:             "messages",
  DISPUTES:             "disputes",
  SYSTEM:               "system",
});

// ============================================================
// PUBLIC vs PRIVATE FOLDER CLASSIFICATION
// Public  → no signed URL required, direct CDN/bucket URL is safe
// Private → must always use signed URLs; never expose raw bucket URL
// ============================================================

export const PUBLIC_STORAGE_FOLDERS = Object.freeze(new Set([
  STORAGE_FOLDERS.AVATARS,
  STORAGE_FOLDERS.SELLER_LOGOS,
  STORAGE_FOLDERS.LISTINGS,
]));

export const PRIVATE_STORAGE_FOLDERS = Object.freeze(new Set(
  Object.values(STORAGE_FOLDERS).filter(f => !PUBLIC_STORAGE_FOLDERS.has(f))
));

/**
 * Returns true when files stored in the given folder are publicly accessible
 * without a signed URL (e.g. listing images, avatars, seller logos).
 *
 * @param {string} folder - A STORAGE_FOLDERS value
 * @returns {boolean}
 */
export function isPublicFolder(folder) {
  return PUBLIC_STORAGE_FOLDERS.has(folder);
}

/**
 * Returns true when files stored in the given folder are private and
 * MUST be served via signed URLs.
 *
 * @param {string} folder
 * @returns {boolean}
 */
export function isPrivateFolder(folder) {
  return !isPublicFolder(folder);
}

// ============================================================
// OBJECT KEY GENERATOR
// ============================================================

/**
 * Generates a UUID-based object key organized into the given folder.
 * Never uses original filenames — prevents path traversal and collisions.
 *
 * @param {string} folder   - One of STORAGE_FOLDERS values
 * @param {string} mimeType - MIME type used to derive a safe extension
 * @returns {string}        - e.g. "avatars/3f2a1b4c-...-uuid.jpg"
 */
export function generateObjectKey(folder, mimeType) {
  const validFolders = Object.values(STORAGE_FOLDERS);
  const resolvedFolder = validFolders.includes(folder) ? folder : STORAGE_FOLDERS.SYSTEM;

  const extension = mimeTypeToExtension(mimeType);
  const uuid = randomUUID();

  return extension
    ? `${resolvedFolder}/${uuid}${extension}`
    : `${resolvedFolder}/${uuid}`;
}

// ============================================================
// MIME → EXTENSION MAP
// ============================================================

const MIME_TO_EXT = {
  "image/jpeg":    ".jpg",
  "image/png":     ".png",
  "image/webp":    ".webp",
  "image/gif":     ".gif",
  "image/svg+xml": ".svg",

  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "text/plain": ".txt",
  "text/csv":   ".csv",

  "application/zip":          ".zip",
  "application/x-zip-compressed": ".zip",
  "application/x-zip":        ".zip",
  "application/x-tar":        ".tar",
  "application/gzip":         ".gz",
  "application/x-7z-compressed": ".7z",
  "application/x-rar-compressed": ".rar",

  "video/mp4":       ".mp4",
  "video/quicktime": ".mov",
  "video/webm":      ".webm",

  "audio/mpeg": ".mp3",
  "audio/wav":  ".wav",
};

/**
 * Returns a safe file extension for the given MIME type.
 * Returns empty string if the MIME type is unknown.
 */
export function mimeTypeToExtension(mimeType) {
  return MIME_TO_EXT[mimeType] ?? "";
}

// ============================================================
// STORAGE OPERATION LOGGER
// ============================================================

/**
 * Logs a storage operation with timing and status.
 * NEVER logs secrets, access keys, presigned URLs, or credentials.
 * In production the bucket name is suppressed.
 *
 * @param {"upload"|"delete"|"head"|"exists"|"signedUrl"|"validate"|"authorize"|"integrity"|"lifecycle"} operation
 * @param {object} meta
 * @param {string}  [meta.bucket]     - Bucket name (suppressed in production)
 * @param {string}  meta.key          - Object key
 * @param {"start"|"success"|"error"} meta.status
 * @param {number}  [meta.durationMs]
 * @param {string}  [meta.errorCode]  - Safe error code only, no SDK details
 */
export function logStorageOperation(operation, { bucket, key, status, durationMs, errorCode } = {}) {
  const ts = new Date().toISOString();
  const duration = typeof durationMs === "number" ? ` (${durationMs}ms)` : "";
  const errPart  = errorCode ? ` [${errorCode}]` : "";

  // Suppress bucket name in production to reduce exposure
  const bucketPart = (process.env.NODE_ENV !== "production" && bucket)
    ? ` bucket=${bucket}`
    : "";

  const line = `[${ts}] STORAGE ${operation.toUpperCase()} ${status.toUpperCase()}${duration}${errPart} key=${key ?? "—"}${bucketPart}`;

  if (status === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}
