// ============================================================
// STORAGE DOWNLOAD ENGINE
// Reusable signed URL and download helpers.
//
// Security:
//   - No bucket internals are ever exposed to callers.
//   - Presigned URLs are NEVER logged.
//   - Authorization is enforced before any URL is generated.
//   - All download/preview events are logged (key + actor only).
// ============================================================

import { generateSignedUrl } from "./storage.service.js";
import { objectExists }      from "./storage.service.js";
import { logStorageOperation } from "./storage.helpers.js";
import { toStorageError, StorageNotFoundError, StorageValidationError } from "./storage.errors.js";
import { assertStorageAccess, StorageAuthorizationError, isFolderPublic, folderFromKey } from "./storage.authorization.js";

// ============================================================
// EXPIRATION PRESETS (seconds)
// ============================================================

export const SIGNED_URL_EXPIRY = Object.freeze({
  ONE_MINUTE:      60,
  FIVE_MINUTES:    5  * 60,
  FIFTEEN_MINUTES: 15 * 60,
  ONE_HOUR:        60 * 60,       // default
  SIX_HOURS:       6  * 60 * 60,
  ONE_DAY:         24 * 60 * 60,
  ONE_WEEK:        7  * 24 * 60 * 60,
});

const DEFAULT_EXPIRY_SECONDS = SIGNED_URL_EXPIRY.ONE_HOUR;
const MAX_EXPIRY_SECONDS     = SIGNED_URL_EXPIRY.ONE_WEEK;

// ============================================================
// DOWNLOAD EVENT LOGGING
// Logs file access events (download, preview, signedUrl generation).
// NEVER logs the presigned URL itself.
// ============================================================

/**
 * Logs a file access event.
 *
 * @param {"download"|"preview"|"signedUrl"} eventType
 * @param {string} key
 * @param {string|null} [actorId] - User ID of the accessor (null for public)
 * @param {"success"|"error"} status
 * @param {number} [durationMs]
 */
function logAccessEvent(eventType, key, actorId, status, durationMs) {
  const ts       = new Date().toISOString();
  const duration = typeof durationMs === "number" ? ` (${durationMs}ms)` : "";
  const actor    = actorId ? ` actor=${actorId}` : "";
  const line     = `[${ts}] STORAGE_ACCESS ${eventType.toUpperCase()} ${status.toUpperCase()}${duration}${actor} key=${key ?? "—"}`;

  if (status === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}

// ============================================================
// SIGNED DOWNLOAD URL — UNAUTHENTICATED (internal / public)
// ============================================================

/**
 * Generates a temporary presigned GET URL for a private S3 object.
 * No authorization check — for internal use where auth is already verified.
 *
 * The returned URL is NEVER logged.
 * Callers must not store it permanently.
 *
 * @param {string} key                        - S3 object key
 * @param {number} [expiresInSeconds=3600]    - TTL in seconds (max: 7 days)
 * @returns {Promise<SignedUrlResult>}
 *
 * @typedef {object} SignedUrlResult
 * @property {string} key            - The S3 object key
 * @property {number} expiresIn      - TTL in seconds
 * @property {string} expiresAt      - ISO 8601 expiration timestamp
 * @property {string} url            - The presigned URL (NEVER log this)
 */
export async function createSignedDownloadUrl(key, expiresInSeconds = DEFAULT_EXPIRY_SECONDS) {
  if (!key || typeof key !== "string") {
    throw new StorageValidationError("A valid object key is required to generate a signed URL.");
  }

  const ttl = Math.min(Math.max(1, Math.floor(expiresInSeconds)), MAX_EXPIRY_SECONDS);

  const start = Date.now();
  logStorageOperation("signedUrl", { key, status: "start" });

  try {
    const url       = await generateSignedUrl(key, ttl);
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

    logStorageOperation("signedUrl", { key, status: "success", durationMs: Date.now() - start });
    // URL is intentionally excluded from all log output

    return Object.freeze({ key, expiresIn: ttl, expiresAt, url });
  } catch (err) {
    logStorageOperation("signedUrl", { key, status: "error", durationMs: Date.now() - start, errorCode: err?.code });
    throw err instanceof StorageValidationError ? err : toStorageError(err, "Failed to generate download URL.");
  }
}

// ============================================================
// AUTHORIZED SIGNED DOWNLOAD URL
// Enforces access control BEFORE generating any URL.
// This is the recommended function for all controller-level calls.
// ============================================================

/**
 * Generates a presigned URL ONLY after verifying the requesting user
 * is authorized to access the file.
 *
 * For public files (listings, avatars, seller-logos), authorization
 * is a no-op — the URL is still generated for API consistency.
 *
 * @param {string} key                     - S3 object key
 * @param {string} userId                  - Requesting user ID
 * @param {string} role                    - Requesting user role
 * @param {number} [expiresInSeconds=3600] - TTL in seconds
 * @returns {Promise<SignedUrlResult>}
 * @throws {StorageAuthorizationError} if the user is not authorized
 */
export async function createAuthorizedSignedUrl(key, userId, role, expiresInSeconds = DEFAULT_EXPIRY_SECONDS) {
  if (!key || typeof key !== "string") {
    throw new StorageValidationError("A valid object key is required.");
  }

  const start = Date.now();

  // Enforce authorization (throws StorageAuthorizationError on denial)
  await assertStorageAccess(key, userId, role);

  const result = await createSignedDownloadUrl(key, expiresInSeconds);

  logAccessEvent("signedUrl", key, userId, "success", Date.now() - start);

  return result;
}

// ============================================================
// CONVENIENCE VARIANTS
// ============================================================

/**
 * Generates a signed URL only if the object exists.
 * Returns null if the object is not found.
 * No authorization check — for internal use.
 *
 * @param {string} key
 * @param {number} [expiresInSeconds]
 * @returns {Promise<SignedUrlResult|null>}
 */
export async function createSignedDownloadUrlIfExists(key, expiresInSeconds = DEFAULT_EXPIRY_SECONDS) {
  if (!key || typeof key !== "string") return null;

  const exists = await objectExists(key);
  if (!exists) return null;

  return createSignedDownloadUrl(key, expiresInSeconds);
}

/**
 * Generates signed URLs for multiple keys in parallel.
 * Skips null/empty keys silently.
 * No authorization check — for internal batch use (e.g. admin operations).
 *
 * @param {string[]} keys
 * @param {number}   [expiresInSeconds]
 * @returns {Promise<Array<SignedUrlResult|null>>} - Parallel result array, null for failures
 */
export async function createMultipleSignedUrls(keys, expiresInSeconds = DEFAULT_EXPIRY_SECONDS) {
  if (!Array.isArray(keys) || keys.length === 0) return [];

  const results = await Promise.allSettled(
    keys.map(key =>
      key && typeof key === "string"
        ? createSignedDownloadUrl(key, expiresInSeconds)
        : Promise.resolve(null)
    )
  );

  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    // Log warning without exposing internal SDK details
    console.warn(`[STORAGE] Failed to generate signed URL for key "${keys[i]}": ${r.reason?.message}`);
    return null;
  });
}

/**
 * Generates authorized signed URLs for multiple keys in parallel.
 * Each key is independently authorized before URL generation.
 * Returns null for keys the user cannot access.
 *
 * @param {string[]} keys
 * @param {string}   userId
 * @param {string}   role
 * @param {number}   [expiresInSeconds]
 * @returns {Promise<Array<SignedUrlResult|null>>}
 */
export async function createMultipleAuthorizedSignedUrls(keys, userId, role, expiresInSeconds = DEFAULT_EXPIRY_SECONDS) {
  if (!Array.isArray(keys) || keys.length === 0) return [];

  const results = await Promise.allSettled(
    keys.map(key =>
      key && typeof key === "string"
        ? createAuthorizedSignedUrl(key, userId, role, expiresInSeconds)
        : Promise.resolve(null)
    )
  );

  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    const isAuthError = r.reason?.code === "STORAGE_AUTHORIZATION_ERROR";
    if (!isAuthError) {
      console.warn(`[STORAGE] Failed to generate signed URL for key "${keys[i]}": ${r.reason?.message}`);
    }
    return null;
  });
}

// ============================================================
// DOWNLOAD LOG HELPERS (for controllers to use)
// ============================================================

/**
 * Logs a file download event. Call this after serving a file to a user.
 * Never log the URL itself — only the key and actor.
 *
 * @param {string}      key
 * @param {string|null} userId - null for unauthenticated (public files)
 */
export function logDownloadEvent(key, userId = null) {
  logAccessEvent("download", key, userId, "success");
}

/**
 * Logs a file preview event.
 *
 * @param {string}      key
 * @param {string|null} userId
 */
export function logPreviewEvent(key, userId = null) {
  logAccessEvent("preview", key, userId, "success");
}
