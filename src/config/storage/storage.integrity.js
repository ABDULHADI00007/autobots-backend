// ============================================================
// STORAGE INTEGRITY
// Verifies that storage references in the database are valid
// and that no orphan or broken metadata exists.
//
// Responsibilities:
//   - Validate all DB-referenced storage keys exist in S3
//   - Identify orphan metadata (DB record without S3 object)
//   - Identify broken S3 references (DB key pointing to missing object)
//   - Detect duplicate keys across documents
//   - Produce structured integrity reports
//
// IMPORTANT:
//   - This module is READ-ONLY — it never modifies S3 or the DB.
//   - Remediation (deletion, re-upload) is left to the caller.
//   - All S3 calls go through the Storage Engine (objectExists).
//   - Never logs credentials, presigned URLs, or bucket names.
// ============================================================

import { objectExists } from "./storage.service.js";
import { logStorageOperation } from "./storage.helpers.js";

// ============================================================
// TYPES
// ============================================================

/**
 * @typedef {object} IntegrityResult
 * @property {string}   checkedAt       - ISO 8601 timestamp
 * @property {number}   total           - Total keys checked
 * @property {number}   valid           - Keys confirmed present in S3
 * @property {string[]} broken          - DB keys with no S3 object
 * @property {string[]} empty           - null/empty keys in DB (orphan metadata)
 * @property {string[]} duplicates      - Keys that appear more than once
 * @property {boolean}  passed          - true if no broken refs and no duplicates
 */

// ============================================================
// CORE CHECK
// ============================================================

/**
 * Verifies a flat list of storage keys against S3.
 * Returns an IntegrityResult report.
 *
 * @param {Array<string|null|undefined>} keys - Raw keys from DB fields
 * @returns {Promise<IntegrityResult>}
 */
export async function verifyStorageKeys(keys) {
  const checkedAt = new Date().toISOString();

  if (!Array.isArray(keys) || keys.length === 0) {
    return { checkedAt, total: 0, valid: 0, broken: [], empty: [], duplicates: [], passed: true };
  }

  // Separate empty from real keys
  const empty    = keys.filter(k => !k || typeof k !== "string" || !k.trim());
  const realKeys = keys.filter(k => k && typeof k === "string" && k.trim());

  // Detect duplicates (before deduplication)
  const seen      = new Set();
  const dupeSet   = new Set();
  for (const k of realKeys) {
    if (seen.has(k)) dupeSet.add(k);
    seen.add(k);
  }
  const duplicates = [...dupeSet];

  // Deduplicate before S3 checks (avoid redundant API calls)
  const uniqueKeys = [...new Set(realKeys)];

  logStorageOperation("integrity", { key: `[check:${uniqueKeys.length}]`, status: "start" });

  const results = await Promise.allSettled(
    uniqueKeys.map(async (key) => {
      const exists = await objectExists(key);
      return { key, exists };
    })
  );

  const valid  = [];
  const broken = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      if (result.value.exists) {
        valid.push(result.value.key);
      } else {
        broken.push(result.value.key);
      }
    } else {
      // S3 check failed — treat as broken for safety
      broken.push(result.reason?.key ?? "unknown");
    }
  }

  const passed = broken.length === 0 && duplicates.length === 0;

  logStorageOperation("integrity", {
    key: `[check:${uniqueKeys.length}]`,
    status: passed ? "success" : "error",
  });

  return {
    checkedAt,
    total:      uniqueKeys.length,
    valid:      valid.length,
    broken,
    empty,
    duplicates,
    passed,
  };
}

// ============================================================
// DOMAIN-SPECIFIC INTEGRITY CHECKS
// ============================================================

/**
 * Checks all storage keys referenced by a list of DB documents.
 *
 * Each document should be a plain object (or Mongoose lean doc) with
 * the keys to verify listed in `keyFields`.
 *
 * @param {object[]} documents      - Array of DB documents
 * @param {string[]} keyFields      - Field names that hold storage keys
 * @param {string}   [label="docs"] - Label used in log output
 * @returns {Promise<IntegrityResult & { byDocument: Array<{ docId: string, result: IntegrityResult }> }>}
 */
export async function verifyDocumentStorageKeys(documents, keyFields, label = "docs") {
  if (!Array.isArray(documents) || documents.length === 0) {
    return {
      checkedAt:  new Date().toISOString(),
      total: 0, valid: 0, broken: [], empty: [], duplicates: [], passed: true,
      byDocument: [],
    };
  }

  logStorageOperation("integrity", { key: `[${label}:${documents.length}]`, status: "start" });

  const byDocument = [];
  const allBroken  = [];
  const allEmpty   = [];
  const allDupes   = [];
  let   totalValid = 0;
  let   totalKeys  = 0;

  for (const doc of documents) {
    const docId   = doc._id?.toString?.() ?? "unknown";
    const rawKeys = [];

    for (const field of keyFields) {
      const val = doc[field];
      if (Array.isArray(val)) {
        rawKeys.push(...val);
      } else if (val) {
        rawKeys.push(val);
      } else {
        // Field is null/undefined — count as empty if it was expected
        rawKeys.push(null);
      }
    }

    const result = await verifyStorageKeys(rawKeys);
    byDocument.push({ docId, result });

    totalKeys  += result.total;
    totalValid += result.valid;
    allBroken.push(...result.broken);
    allEmpty.push(...result.empty);
    allDupes.push(...result.duplicates);
  }

  const passed = allBroken.length === 0 && allDupes.length === 0;

  logStorageOperation("integrity", {
    key:    `[${label}:${documents.length}]`,
    status: passed ? "success" : "error",
  });

  return {
    checkedAt:  new Date().toISOString(),
    total:      totalKeys,
    valid:      totalValid,
    broken:     allBroken,
    empty:      allEmpty,
    duplicates: allDupes,
    passed,
    byDocument,
  };
}

// ============================================================
// INTEGRITY SUMMARY FORMATTER
// Safe for logging — never includes keys themselves in production.
// ============================================================

/**
 * Produces a production-safe summary string from an IntegrityResult.
 * Does NOT include the actual key values in the output.
 *
 * @param {IntegrityResult} result
 * @param {string} [context="storage"]
 * @returns {string}
 */
export function formatIntegritySummary(result, context = "storage") {
  const { checkedAt, total, valid, broken, empty, duplicates, passed } = result;
  const status = passed ? "PASS" : "FAIL";
  return (
    `[INTEGRITY:${context}] ${status} ` +
    `checked=${total} valid=${valid} ` +
    `broken=${broken.length} empty=${empty.length} duplicates=${duplicates.length} ` +
    `at=${checkedAt}`
  );
}
