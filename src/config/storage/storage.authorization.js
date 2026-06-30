// ============================================================
// STORAGE AUTHORIZATION
// Centralized file access control for all private storage domains.
//
// Rules:
//   - Admins may access any file.
//   - Owners (uploaders) may access their own files.
//   - Buyers/sellers may access files tied to orders they participate in.
//   - No user may access files from unrelated conversations or disputes.
//   - Signed URLs are only generated AFTER authorization passes.
//   - Authorization failures throw a StorageAuthorizationError.
//
// This module NEVER touches S3 directly.
// All storage calls go through storage.engine.js / storage.index.js.
// ============================================================

import { StorageError } from "./storage.errors.js";
import { logStorageOperation } from "./storage.helpers.js";

// ============================================================
// AUTHORIZATION ERROR
// ============================================================

export class StorageAuthorizationError extends StorageError {
  constructor(message = "Access to this file is denied.") {
    super(message, "STORAGE_AUTHORIZATION_ERROR");
    this.name = "StorageAuthorizationError";
    this.statusCode = 403;
  }
}

// ============================================================
// FILE CLASSIFICATION
// Public:  Listing images, Seller logos/banners, Avatars
// Private: Identity docs, Seller applications, Deliveries,
//          Messages, Evidence/Disputes
// ============================================================

const PUBLIC_FOLDERS = new Set(["listings", "avatars", "seller-logos"]);

/**
 * Returns whether a storage folder contains public files.
 * Public files do not require signed URLs or authorization checks.
 *
 * @param {string} folder - A STORAGE_FOLDERS value
 * @returns {boolean}
 */
export function isFolderPublic(folder) {
  return PUBLIC_FOLDERS.has(folder);
}

/**
 * Returns whether a storage folder contains private files.
 *
 * @param {string} folder
 * @returns {boolean}
 */
export function isFolderPrivate(folder) {
  return !isFolderPublic(folder);
}

/**
 * Infers a folder from a storage key by extracting the prefix segment.
 * e.g. "deliveries/abc-uuid.pdf" → "deliveries"
 *
 * @param {string} key
 * @returns {string|null}
 */
export function folderFromKey(key) {
  if (!key || typeof key !== "string") return null;
  const slash = key.indexOf("/");
  return slash > 0 ? key.slice(0, slash) : null;
}

/**
 * Returns true if the given key belongs to a private folder.
 * Unknown keys are treated as private by default (fail closed).
 *
 * @param {string} key
 * @returns {boolean}
 */
export function isKeyPrivate(key) {
  const folder = folderFromKey(key);
  return folder ? isFolderPrivate(folder) : true;
}

// ============================================================
// INTERNAL HELPERS
// ============================================================

function toStr(id) {
  return id?.toString?.() ?? String(id ?? "");
}

function isOrderParticipant(order, userId) {
  if (!order) return false;
  const buyerId  = order.buyerId?._id  ?? order.buyerId;
  const sellerId = order.sellerId?._id ?? order.sellerId;
  return toStr(buyerId) === userId || toStr(sellerId) === userId;
}

// ============================================================
// DOMAIN-SPECIFIC ACCESS CHECKS
// Lazy imports prevent circular dependency issues at module load time.
// ============================================================

async function canAccessDeliveryFile(key, userId) {
  const [
    { default: Attachment },
    { default: Delivery },
    { default: Order },
  ] = await Promise.all([
    import("../../modules/attachments/attachment.model.js"),
    import("../../modules/deliveries/delivery.model.js"),
    import("../../modules/orders/order.model.js"),
  ]);

  const attachment = await Attachment.findOne({ storageKey: key }).select("parentId");
  if (!attachment) return false;

  const delivery = await Delivery.findById(attachment.parentId).select("orderId");
  if (!delivery) return false;

  const order = await Order.findById(delivery.orderId).select("buyerId sellerId");
  return isOrderParticipant(order, userId);
}

async function canAccessMessageFile(key, userId) {
  const [
    { default: Attachment },
    { default: Message },
    { default: ConversationParticipant },
  ] = await Promise.all([
    import("../../modules/attachments/attachment.model.js"),
    import("../../modules/conversations/message.model.js"),
    import("../../modules/conversations/conversationParticipant.model.js"),
  ]);

  const attachment = await Attachment.findOne({ storageKey: key }).select("parentId");
  if (!attachment) return false;

  const message = await Message.findById(attachment.parentId).select("conversationId");
  if (!message) return false;

  const participant = await ConversationParticipant.findOne({
    conversationId: message.conversationId,
    userId,
  });
  return Boolean(participant);
}

async function canAccessDisputeFile(key, userId) {
  const [
    { default: Attachment },
    { default: Evidence },
    { default: Dispute },
    { default: Order },
  ] = await Promise.all([
    import("../../modules/attachments/attachment.model.js"),
    import("../../modules/evidence/evidence.model.js"),
    import("../../modules/disputes/dispute.model.js"),
    import("../../modules/orders/order.model.js"),
  ]);

  const attachment = await Attachment.findOne({ storageKey: key }).select("parentId parentType");
  if (!attachment) return false;

  let orderId = null;

  if (attachment.parentType === "evidence") {
    const evidence = await Evidence.findById(attachment.parentId).select("disputeId visibility");
    if (!evidence) return false;
    // Participants only see participant-visible evidence
    if (evidence.visibility !== "participant-visible") return false;
    const dispute = await Dispute.findById(evidence.disputeId).select("orderId");
    if (!dispute) return false;
    orderId = dispute.orderId;
  } else {
    const dispute = await Dispute.findById(attachment.parentId).select("orderId");
    if (!dispute) return false;
    orderId = dispute.orderId;
  }

  const order = await Order.findById(orderId).select("buyerId sellerId");
  return isOrderParticipant(order, userId);
}

async function canAccessSellerApplicationFile(key, userId) {
  const { default: SellerApplication } = await import("../../modules/sellerApplications/sellerApplication.model.js");

  const application = await SellerApplication.findOne({
    $or: [
      { identityDocKey:    key },
      { portfolioFileKey:  key },
      { supportingDocKeys: key },
    ],
  }).select("userId");

  if (!application) return false;
  return toStr(application.userId) === userId;
}

// ============================================================
// MAIN AUTHORIZATION FUNCTION
// ============================================================

/**
 * Asserts that the given user is authorized to access the S3 object at `key`.
 * Throws StorageAuthorizationError on denial.
 * No-ops silently for public folders.
 *
 * @param {string} key    - S3 object key
 * @param {string} userId - Authenticated user ID string
 * @param {string} role   - Authenticated user role ("buyer"|"seller"|"admin")
 * @throws {StorageAuthorizationError}
 */
export async function assertStorageAccess(key, userId, role) {
  const folder = folderFromKey(key);

  // Public files: no authorization required
  if (folder && isFolderPublic(folder)) {
    logStorageOperation("authorize", { key, status: "success" });
    return;
  }

  // Admin bypass: admins may access any file
  if (role === "admin") {
    logStorageOperation("authorize", { key, status: "success" });
    return;
  }

  let allowed = false;

  try {
    switch (folder) {
      case "deliveries":
        allowed = await canAccessDeliveryFile(key, userId);
        break;

      case "messages":
        allowed = await canAccessMessageFile(key, userId);
        break;

      case "disputes":
        allowed = await canAccessDisputeFile(key, userId);
        break;

      case "seller-applications":
        allowed = await canAccessSellerApplicationFile(key, userId);
        break;

      case "avatars":
      case "seller-logos":
      case "listings":
        // Public folders — should have returned above, defensive fallback
        allowed = true;
        break;

      default:
        // Unknown folder → deny by default (fail closed)
        allowed = false;
    }
  } catch {
    // Authorization checks must never leak internal errors
    logStorageOperation("authorize", { key, status: "error", errorCode: "AUTH_CHECK_FAILED" });
    throw new StorageAuthorizationError("Unable to verify access to this file.");
  }

  if (!allowed) {
    logStorageOperation("authorize", { key, status: "error", errorCode: "DENIED" });
    throw new StorageAuthorizationError("You do not have permission to access this file.");
  }

  logStorageOperation("authorize", { key, status: "success" });
}

/**
 * Non-throwing variant. Returns true if access is allowed, false otherwise.
 *
 * @param {string} key
 * @param {string} userId
 * @param {string} role
 * @returns {Promise<boolean>}
 */
export async function checkStorageAccess(key, userId, role) {
  try {
    await assertStorageAccess(key, userId, role);
    return true;
  } catch {
    return false;
  }
}
