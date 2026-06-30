// ============================================================
// STORAGE ERRORS
// Centralized, production-safe storage error types.
// Never exposes AWS credentials, bucket names, stack traces,
// or internal SDK details to callers.
// ============================================================

export class StorageError extends Error {
  constructor(message, code = "STORAGE_ERROR", cause = null) {
    super(message);
    this.name = "StorageError";
    this.code = code;
    if (cause) this.cause = cause;
  }
}

export class StorageConfigError extends StorageError {
  constructor(message, cause = null) {
    super(message, "STORAGE_CONFIG_ERROR", cause);
    this.name = "StorageConfigError";
  }
}

export class StorageUploadError extends StorageError {
  constructor(message, cause = null) {
    super(message, "STORAGE_UPLOAD_ERROR", cause);
    this.name = "StorageUploadError";
  }
}

export class StorageDeleteError extends StorageError {
  constructor(message, cause = null) {
    super(message, "STORAGE_DELETE_ERROR", cause);
    this.name = "StorageDeleteError";
  }
}

export class StorageNotFoundError extends StorageError {
  constructor(message = "Object not found", cause = null) {
    super(message, "STORAGE_NOT_FOUND", cause);
    this.name = "StorageNotFoundError";
  }
}

export class StorageValidationError extends StorageError {
  constructor(message, cause = null) {
    super(message, "STORAGE_VALIDATION_ERROR", cause);
    this.name = "StorageValidationError";
  }
}

export class StorageBucketError extends StorageError {
  constructor(message, cause = null) {
    super(message, "STORAGE_BUCKET_ERROR", cause);
    this.name = "StorageBucketError";
  }
}

// ============================================================
// SAFE ERROR SANITIZER
// Strips any SDK internals before returning errors to callers.
// ============================================================

/**
 * Converts any raw AWS SDK error into a production-safe StorageError.
 * Never leaks credentials, bucket names, ARNs, or stack traces.
 */
export function toStorageError(err, fallbackMessage = "A storage error occurred") {
  if (err instanceof StorageError) return err;

  const code = err?.Code || err?.code || err?.name || "UNKNOWN";

  const safeMessages = {
    NoSuchBucket: "The storage bucket could not be found.",
    NoSuchKey: "The requested object does not exist.",
    AccessDenied: "Access to storage was denied.",
    InvalidAccessKeyId: "Storage credentials are invalid.",
    SignatureDoesNotMatch: "Storage credentials are invalid.",
    RequestTimeout: "The storage request timed out.",
    ServiceUnavailable: "The storage service is temporarily unavailable.",
    SlowDown: "Too many storage requests. Please try again shortly.",
    NotFound: "The requested object does not exist.",
  };

  const safeMessage = safeMessages[code] || fallbackMessage;
  return new StorageError(safeMessage, `STORAGE_AWS_${code.toUpperCase()}`);
}
