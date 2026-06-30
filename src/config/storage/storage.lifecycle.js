// ============================================================
// STORAGE LIFECYCLE MANAGEMENT
// Reusable helpers for file lifecycle operations.
//
// Supports:
//   - Soft delete (mark as deleted without removing from S3)
//   - Archive (move to archive tier — future)
//   - Retention policy checks
//   - Scheduled orphan cleanup helpers
//
// IMPORTANT:
//   - Does NOT change any business logic.
//   - Does NOT change any API behavior.
//   - All S3 operations go through storage.engine.js (never direct SDK).
//   - Lifecycle records are advisory only; DB is source of truth.
// ============================================================

import { logStorageOperation } from "./storage.helpers.js";
import { StorageValidationError } from "./storage.errors.js";

// ============================================================
// LIFECYCLE STATUS CONSTANTS
// ============================================================

export const LIFECYCLE_STATUS = Object.freeze({
  ACTIVE:    "active",
  ARCHIVED:  "archived",
  SOFT_DELETED: "soft_deleted",
  PENDING_DELETION: "pending_deletion",
});

// ============================================================
// RETENTION PRESETS (days)
// ============================================================

export const RETENTION_DAYS = Object.freeze({
  MESSAGES:            90,   // Message attachments kept 90 days after conversation close
  DELIVERIES:          365,  // Delivery files kept 1 year
  EVIDENCE:            730,  // Dispute evidence kept 2 years
  SELLER_APPLICATIONS: 1825, // Seller application docs kept 5 years (regulatory)
  LISTINGS:            180,  // Listing media kept 6 months after listing removal
  AVATARS:             30,   // Avatars kept 30 days after user deletion
});

// ============================================================
// LIFECYCLE RECORD SHAPE
// Used for in-memory tracking; modules may persist if needed.
// ============================================================

/**
 * Creates a lifecycle record for a storage object.
 * This is a plain object — persistence is the caller's responsibility.
 *
 * @param {object} opts
 * @param {string} opts.key           - S3 object key
 * @param {string} opts.folder        - Storage folder (STORAGE_FOLDERS value)
 * @param {string} opts.ownerId       - User/entity that owns the object
 * @param {string} [opts.status]      - LIFECYCLE_STATUS value (default: active)
 * @param {number} [opts.retentionDays] - Override default retention period
 * @returns {LifecycleRecord}
 *
 * @typedef {object} LifecycleRecord
 * @property {string} key
 * @property {string} folder
 * @property {string} ownerId
 * @property {string} status
 * @property {string} createdAt
 * @property {string|null} archivedAt
 * @property {string|null} deletedAt
 * @property {string} expiresAt
 */
export function createLifecycleRecord({ key, folder, ownerId, status = LIFECYCLE_STATUS.ACTIVE, retentionDays }) {
  if (!key || !folder || !ownerId) {
    throw new StorageValidationError("createLifecycleRecord requires key, folder, and ownerId.");
  }

  const days = retentionDays ?? retentionDaysForFolder(folder);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  return Object.freeze({
    key,
    folder,
    ownerId,
    status,
    createdAt:  new Date().toISOString(),
    archivedAt: null,
    deletedAt:  null,
    expiresAt,
  });
}

// ============================================================
// RETENTION HELPERS
// ============================================================

/**
 * Returns the default retention period in days for a given folder.
 *
 * @param {string} folder
 * @returns {number}
 */
export function retentionDaysForFolder(folder) {
  const map = {
    "messages":             RETENTION_DAYS.MESSAGES,
    "deliveries":           RETENTION_DAYS.DELIVERIES,
    "disputes":             RETENTION_DAYS.EVIDENCE,
    "seller-applications":  RETENTION_DAYS.SELLER_APPLICATIONS,
    "listings":             RETENTION_DAYS.LISTINGS,
    "avatars":              RETENTION_DAYS.AVATARS,
    "seller-logos":         RETENTION_DAYS.AVATARS,
    "reviews":              RETENTION_DAYS.DELIVERIES,
    "system":               RETENTION_DAYS.DELIVERIES,
  };
  return map[folder] ?? RETENTION_DAYS.DELIVERIES;
}

/**
 * Returns true if a lifecycle record has passed its retention deadline.
 *
 * @param {LifecycleRecord} record
 * @returns {boolean}
 */
export function isRetentionExpired(record) {
  if (!record?.expiresAt) return false;
  return new Date(record.expiresAt) <= new Date();
}

/**
 * Returns the expiration date for a given folder and creation time.
 *
 * @param {string} folder
 * @param {Date|string} [createdAt=now]
 * @returns {Date}
 */
export function computeExpiresAt(folder, createdAt = new Date()) {
  const days = retentionDaysForFolder(folder);
  const base = new Date(createdAt);
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

// ============================================================
// SOFT DELETE
// ============================================================

/**
 * Marks a lifecycle record as soft-deleted.
 * Does NOT delete the S3 object — use storage.delete.one() for that.
 * Returns an updated (frozen) record.
 *
 * @param {LifecycleRecord} record
 * @returns {LifecycleRecord}
 */
export function softDeleteRecord(record) {
  if (!record?.key) {
    throw new StorageValidationError("softDeleteRecord requires a valid lifecycle record.");
  }
  logStorageOperation("lifecycle", { key: record.key, status: "start" });

  const updated = Object.freeze({
    ...record,
    status:    LIFECYCLE_STATUS.SOFT_DELETED,
    deletedAt: new Date().toISOString(),
  });

  logStorageOperation("lifecycle", { key: record.key, status: "success" });
  return updated;
}

// ============================================================
// ARCHIVE
// ============================================================

/**
 * Marks a lifecycle record as archived.
 * Future: this will trigger a storage tier transition (S3 Glacier etc.).
 * Currently: updates the record status only — no S3 tier change yet.
 *
 * @param {LifecycleRecord} record
 * @returns {LifecycleRecord}
 */
export function archiveRecord(record) {
  if (!record?.key) {
    throw new StorageValidationError("archiveRecord requires a valid lifecycle record.");
  }
  logStorageOperation("lifecycle", { key: record.key, status: "start" });

  const updated = Object.freeze({
    ...record,
    status:     LIFECYCLE_STATUS.ARCHIVED,
    archivedAt: new Date().toISOString(),
  });

  logStorageOperation("lifecycle", { key: record.key, status: "success" });
  return updated;
}

// ============================================================
// ORPHAN DETECTION
// ============================================================

/**
 * Identifies potentially orphaned storage keys by checking whether
 * all given keys exist in the provided DB key set.
 *
 * Usage:
 *   const s3Keys   = [...]; // from S3 ListObjects
 *   const dbKeys   = new Set([...]);  // keys stored in DB
 *   const orphans  = findOrphanKeys(s3Keys, dbKeys);
 *
 * @param {string[]} storageKeys - All S3 keys in a folder
 * @param {Set<string>} dbKeys   - Keys that have valid DB references
 * @returns {string[]}           - Keys with no DB reference (candidate orphans)
 */
export function findOrphanKeys(storageKeys, dbKeys) {
  if (!Array.isArray(storageKeys) || !(dbKeys instanceof Set)) return [];
  return storageKeys.filter(key => !dbKeys.has(key));
}

/**
 * Identifies broken DB references: keys stored in DB that are not
 * present in the given set of S3 keys.
 *
 * @param {string[]} dbKeys      - Keys stored in the database
 * @param {Set<string>} s3Keys   - Keys that actually exist in S3
 * @returns {string[]}           - DB keys with no corresponding S3 object
 */
export function findBrokenReferences(dbKeys, s3Keys) {
  if (!Array.isArray(dbKeys) || !(s3Keys instanceof Set)) return [];
  return dbKeys.filter(key => key && !s3Keys.has(key));
}

// ============================================================
// SCHEDULED CLEANUP HELPER
// ============================================================

/**
 * Filters a list of lifecycle records down to those eligible for deletion.
 * Eligible: soft_deleted OR (active AND retention expired).
 *
 * Call this periodically (e.g., cron job) to identify objects ready for removal.
 *
 * @param {LifecycleRecord[]} records
 * @returns {LifecycleRecord[]}
 */
export function getRecordsDueForDeletion(records) {
  if (!Array.isArray(records)) return [];
  return records.filter(r =>
    r.status === LIFECYCLE_STATUS.SOFT_DELETED ||
    r.status === LIFECYCLE_STATUS.PENDING_DELETION ||
    (r.status === LIFECYCLE_STATUS.ACTIVE && isRetentionExpired(r))
  );
}

/**
 * Groups a list of lifecycle records by their folder.
 *
 * @param {LifecycleRecord[]} records
 * @returns {Record<string, LifecycleRecord[]>}
 */
export function groupByFolder(records) {
  return records.reduce((acc, r) => {
    const folder = r.folder ?? "unknown";
    if (!acc[folder]) acc[folder] = [];
    acc[folder].push(r);
    return acc;
  }, {});
}
