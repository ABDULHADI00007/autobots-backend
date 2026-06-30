// ============================================================
// STORAGE VALIDATION
// Reusable file validation helpers.
// Reject unsupported files before they reach S3.
// ============================================================

import { StorageValidationError } from "./storage.errors.js";

// ============================================================
// ALLOWED TYPES REGISTRY
// ============================================================

export const ALLOWED_MIME_TYPES = Object.freeze({
  images: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/svg+xml",
  ],
  documents: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/csv",
  ],
  archives: [
    "application/zip",
    "application/x-zip-compressed",
    "application/x-zip",
    "application/x-tar",
    "application/gzip",
    "application/x-7z-compressed",
    "application/x-rar-compressed",
  ],
  videos: [
    "video/mp4",
    "video/quicktime",
    "video/webm",
  ],
  audio: [
    "audio/mpeg",
    "audio/wav",
  ],
});

export const ALL_ALLOWED_MIME_TYPES = Object.freeze([
  ...ALLOWED_MIME_TYPES.images,
  ...ALLOWED_MIME_TYPES.documents,
  ...ALLOWED_MIME_TYPES.archives,
  ...ALLOWED_MIME_TYPES.videos,
  ...ALLOWED_MIME_TYPES.audio,
]);

export const ALLOWED_EXTENSIONS = Object.freeze([
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg",
  ".pdf", ".doc", ".docx", ".txt", ".csv",
  ".zip", ".tar", ".gz", ".7z", ".rar",
  ".mp4", ".mov", ".webm",
  ".mp3", ".wav",
]);

// ============================================================
// SIZE LIMITS (bytes)
// ============================================================

export const SIZE_LIMITS = Object.freeze({
  image:    10  * 1024 * 1024,  // 10 MB
  document: 25  * 1024 * 1024,  // 25 MB
  archive:  100 * 1024 * 1024,  // 100 MB
  video:    250 * 1024 * 1024,  // 250 MB
  audio:    50  * 1024 * 1024,  // 50 MB
  default:  10  * 1024 * 1024,  // 10 MB fallback
});

// ============================================================
// INTERNAL HELPERS
// ============================================================

function categoryForMime(mimeType) {
  if (ALLOWED_MIME_TYPES.images.includes(mimeType))    return "image";
  if (ALLOWED_MIME_TYPES.documents.includes(mimeType)) return "document";
  if (ALLOWED_MIME_TYPES.archives.includes(mimeType))  return "archive";
  if (ALLOWED_MIME_TYPES.videos.includes(mimeType))    return "video";
  if (ALLOWED_MIME_TYPES.audio.includes(mimeType))     return "audio";
  return null;
}

function sizeLimitForMime(mimeType) {
  const category = categoryForMime(mimeType);
  return category ? SIZE_LIMITS[category] : SIZE_LIMITS.default;
}

// ============================================================
// VALIDATORS
// ============================================================

/**
 * Validates that a MIME type is in the allowed list.
 * @param {string} mimeType
 * @param {string[]} [allowedMimeTypes] - Defaults to ALL_ALLOWED_MIME_TYPES
 * @throws {StorageValidationError}
 */
export function validateMimeType(mimeType, allowedMimeTypes = ALL_ALLOWED_MIME_TYPES) {
  if (!mimeType || typeof mimeType !== "string") {
    throw new StorageValidationError("File MIME type is required.");
  }
  if (!allowedMimeTypes.includes(mimeType)) {
    throw new StorageValidationError(`File type "${mimeType}" is not supported.`);
  }
}

/**
 * Validates that a filename extension is in the allowed list.
 * @param {string} fileName
 * @param {string[]} [allowedExtensions] - Defaults to ALLOWED_EXTENSIONS
 * @throws {StorageValidationError}
 */
export function validateExtension(fileName, allowedExtensions = ALLOWED_EXTENSIONS) {
  if (!fileName || typeof fileName !== "string") {
    throw new StorageValidationError("File name is required.");
  }
  const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  if (!ext || !allowedExtensions.includes(ext)) {
    throw new StorageValidationError(`File extension "${ext || "none"}" is not supported.`);
  }
}

/**
 * Validates that a buffer is not empty.
 * Empty buffers are rejected before reaching S3.
 *
 * @param {Buffer} buffer
 * @throws {StorageValidationError}
 */
export function validateNotEmpty(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.byteLength === 0) {
    throw new StorageValidationError("File content is empty. Empty files are not allowed.");
  }
}

/**
 * Validates that a MIME type string is well-formed.
 * Rejects obviously malformed or injection-style values.
 *
 * @param {string} mimeType
 * @throws {StorageValidationError}
 */
export function validateMimeTypeFormat(mimeType) {
  if (!mimeType || typeof mimeType !== "string") {
    throw new StorageValidationError("File MIME type is required.");
  }
  // MIME type must be "type/subtype" — reject anything suspicious
  if (!/^[a-z0-9][a-z0-9!#$&\-^_]*\/[a-z0-9][a-z0-9!#$&\-^_.+]*$/i.test(mimeType)) {
    throw new StorageValidationError("Invalid MIME type format.");
  }
}

/**
 * Validates that a file's size is within the allowed limit for its type.
 * @param {number} sizeBytes
 * @param {string} mimeType
 * @param {number} [maxBytes] - Override the auto-resolved limit
 * @throws {StorageValidationError}
 */
export function validateFileSize(sizeBytes, mimeType, maxBytes) {
  if (typeof sizeBytes !== "number" || sizeBytes <= 0) {
    throw new StorageValidationError("File is empty or has an invalid size. Files must have content.");
  }
  const limit = maxBytes ?? sizeLimitForMime(mimeType);
  const limitMB = Math.round(limit / (1024 * 1024));
  if (sizeBytes > limit) {
    throw new StorageValidationError(
      `File size ${(sizeBytes / (1024 * 1024)).toFixed(1)} MB exceeds the ${limitMB} MB limit for this file type.`
    );
  }
}

/**
 * Convenience: runs MIME type format, MIME allow-list, extension, and size validation.
 * Also rejects empty files (sizeBytes === 0 or negative).
 *
 * @param {{ fileName: string, mimeType: string, sizeBytes: number }} opts
 * @param {{ allowedMimeTypes?: string[], allowedExtensions?: string[], maxBytes?: number }} [constraints]
 * @throws {StorageValidationError}
 */
export function validateFile({ fileName, mimeType, sizeBytes }, constraints = {}) {
  validateMimeTypeFormat(mimeType);
  validateMimeType(mimeType, constraints.allowedMimeTypes);
  validateExtension(fileName, constraints.allowedExtensions);
  validateFileSize(sizeBytes, mimeType, constraints.maxBytes);
}
