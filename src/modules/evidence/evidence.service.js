import mongoose from "mongoose";
import Evidence from "./evidence.model.js";
import Dispute from "../disputes/dispute.model.js";
import Order from "../orders/order.model.js";
import Attachment from "../attachments/attachment.model.js";
import TimelineEvent from "../timeline/timelineEvent.model.js";
import User from "../users/user.model.js";
import { storage } from "../../config/storage/index.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function objectIdLike(v) {
  return mongoose.Types.ObjectId.isValid(v);
}

/**
 * Load dispute + order, verify they exist, return both.
 */
async function loadDisputeAndOrder(disputeId) {
  const dispute = await Dispute.findById(disputeId);
  if (!dispute) throw new Error("Dispute not found");

  const order = await Order.findById(dispute.orderId).select("buyerId sellerId");
  if (!order) throw new Error("Order not found");

  return { dispute, order };
}

/**
 * Check whether userId is a participant of the dispute (buyer or seller on the order).
 */
function isParticipant(order, userId) {
  const buyerId  = order.buyerId?._id  ?? order.buyerId;
  const sellerId = order.sellerId?._id ?? order.sellerId;
  return (
    buyerId?.toString()  === userId.toString() ||
    sellerId?.toString() === userId.toString()
  );
}

/**
 * Assert that the caller can access the dispute.
 * Admin: always allowed.
 * Buyer/Seller: must be a participant on the order.
 */
async function assertDisputeAccess(disputeId, userId, role) {
  if (role === "admin") return;
  if (!objectIdLike(disputeId)) throw new Error("Invalid dispute ID");

  const { order } = await loadDisputeAndOrder(disputeId);
  if (!isParticipant(order, userId)) throw new Error("Access denied");
}

/**
 * Visibility filter applied when non-admin users list evidence.
 * Buyers and sellers may only see participant-visible evidence.
 */
function visibilityFilter(role) {
  if (role === "admin") return {}; // no filter — admin sees everything
  return { visibility: "participant-visible" };
}

/**
 * Write a timeline event scoped to the dispute.
 */
async function writeTimeline({ disputeId, eventType, actorId, title, description, payload, visibility }) {
  try {
    await TimelineEvent.create({
      scopeType: "dispute",
      scopeId:   disputeId,
      eventType,
      actorId,
      title,
      description: description || "",
      payload:     payload     || {},
      visibility:  visibility  || "participants",
    });
  } catch (err) {
    console.error("[evidence:timeline]", { disputeId, eventType, visibility, error: err?.message || err });
  }
}

/**
 * Verify that all supplied attachmentIds exist and belong to this evidence
 * parentId (i.e. parentType="evidence", parentId=evidenceId).
 * We accept pre-created attachments where parentId === evidenceId already,
 * or we accept attachments with parentId === disputeId (uploaded via the
 * generic attachment route before evidence doc creation).
 *
 * If an attachment's parentId is the disputeId we re-parent it to the evidence.
 */
async function resolveAndReparentAttachments(attachmentIds, evidenceId, disputeId, uploaderId, role) {
  if (!attachmentIds || attachmentIds.length === 0) return [];

  const docs = await Attachment.find({ _id: { $in: attachmentIds } });

  const resolved = [];
  for (const doc of docs) {
    const uploader = doc.uploaderId?.toString?.() ?? doc.uploaderId?.toString();
    const isOwner  = uploader === uploaderId.toString();

    if (role !== "admin" && !isOwner) {
      throw new Error(`Attachment ${doc._id} does not belong to you`);
    }

    // Accept parentType=evidence (already scoped) or parentType=evidence parentId=disputeId
    const parentStr = doc.parentId?.toString?.() ?? doc.parentId?.toString();
    if (doc.parentType === "evidence") {
      if (
        parentStr === evidenceId.toString() ||
        parentStr === disputeId.toString()
      ) {
        // Re-parent to this evidence doc if still pointing at disputeId
        if (parentStr !== evidenceId.toString()) {
          await Attachment.findByIdAndUpdate(doc._id, { parentId: evidenceId });
        }
        resolved.push(doc._id);
      } else {
        throw new Error(`Attachment ${doc._id} is already linked to a different evidence record`);
      }
    } else {
      throw new Error(`Attachment ${doc._id} is not an evidence attachment (parentType must be "evidence")`);
    }
  }

  return resolved;
}

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * Create an evidence record for a dispute.
 * The caller must be a participant (buyer/seller) or admin.
 * Participants cannot set admin-only or internal-only visibility.
 */
export async function createEvidence(disputeId, { title, description, sourceType, visibility, attachmentIds }, userId, role) {
  if (!objectIdLike(disputeId)) throw new Error("Invalid dispute ID");

  await assertDisputeAccess(disputeId, userId, role);

  // Block uploads to resolved disputes (backend enforcement — frontend also gates this)
  const { dispute } = await loadDisputeAndOrder(disputeId);
  if (dispute.status === "resolved") {
    throw new Error("Cannot submit evidence to a resolved dispute");
  }

  // Participants cannot create admin-only / internal-only evidence
  if (role !== "admin" && visibility !== "participant-visible") {
    throw new Error("Only admins can create admin-only or internal-only evidence");
  }

  // Create the evidence doc first so we have its _id for attachment re-parenting
  const evidence = await Evidence.create({
    disputeId,
    uploadedBy:  userId,
    uploaderRole: role,
    title,
    description: description || "",
    sourceType:  sourceType  || "other",
    visibility:  visibility  || "participant-visible",
    attachmentIds: [],
  });

  // Resolve and re-parent attachments
  const resolvedIds = await resolveAndReparentAttachments(
    attachmentIds,
    evidence._id,
    disputeId,
    userId,
    role
  );

  evidence.attachmentIds = resolvedIds;
  await evidence.save();

  // Timeline: EvidenceUploaded
  const timelineVisibility = visibility === "participant-visible" ? "participants" : "admin";
  await writeTimeline({
    disputeId,
    eventType:  "EvidenceUploaded",
    actorId:    userId,
    title:      "Evidence submitted",
    description: `"${title}" submitted by ${role}`,
    payload:    { evidenceId: evidence._id, sourceType, attachmentCount: resolvedIds.length },
    visibility: timelineVisibility,
  });

  return evidence
    .populate("uploadedBy", "name email role")
    .then(doc => doc.populate("attachmentIds"))
    .then(doc => doc.populate("verifiedBy", "name email"));
}

/**
 * List all evidence for a dispute.
 * Non-admins only see participant-visible records.
 */
export async function listEvidence(disputeId, userId, role) {
  if (!objectIdLike(disputeId)) throw new Error("Invalid dispute ID");

  await assertDisputeAccess(disputeId, userId, role);

  const filter = { disputeId, ...visibilityFilter(role) };

  const records = await Evidence.find(filter)
    .sort({ createdAt: 1 })
    .populate("uploadedBy", "name email role")
    .populate("attachmentIds")
    .populate("verifiedBy", "name email");

  return records;
}

/**
 * Get a single evidence record by ID.
 */
export async function getEvidence(evidenceId, userId, role) {
  if (!objectIdLike(evidenceId)) throw new Error("Invalid evidence ID");

  const evidence = await Evidence.findById(evidenceId)
    .populate("uploadedBy", "name email role")
    .populate("attachmentIds")
    .populate("verifiedBy", "name email");

  if (!evidence) throw new Error("Evidence not found");

  await assertDisputeAccess(evidence.disputeId.toString(), userId, role);

  // Visibility check for non-admins
  if (role !== "admin" && evidence.visibility !== "participant-visible") {
    throw new Error("Access denied");
  }

  return evidence;
}

/**
 * Admin verifies an evidence record.
 */
export async function verifyEvidence(evidenceId, adminId) {
  if (!objectIdLike(evidenceId)) throw new Error("Invalid evidence ID");

  const evidence = await Evidence.findById(evidenceId);
  if (!evidence) throw new Error("Evidence not found");

  if (evidence.verifiedAt) throw new Error("Evidence is already verified");

  evidence.verifiedAt = new Date();
  evidence.verifiedBy = adminId;
  await evidence.save();

  // Timeline: EvidenceReviewed
  await writeTimeline({
    disputeId:  evidence.disputeId,
    eventType:  "EvidenceReviewed",
    actorId:    adminId,
    title:      "Evidence reviewed by admin",
    description: `Evidence "${evidence.title}" marked as reviewed`,
    payload:    { evidenceId, verifiedAt: evidence.verifiedAt },
    visibility: "admin",
  });

  return evidence
    .populate("uploadedBy", "name email role")
    .then(doc => doc.populate("attachmentIds"))
    .then(doc => doc.populate("verifiedBy", "name email"));
}

/**
 * Admin requests evidence from a specific participant.
 * Creates a timeline event visible to that participant.
 */
export async function requestEvidence(disputeId, { targetUserId, message }, adminId) {
  if (!objectIdLike(disputeId)) throw new Error("Invalid dispute ID");
  if (!objectIdLike(targetUserId)) throw new Error("Invalid target user ID");

  const { order } = await loadDisputeAndOrder(disputeId);

  // Target must be a participant
  if (!isParticipant(order, targetUserId)) {
    throw new Error("Target user is not a participant in this dispute");
  }

  const targetUser = await User.findById(targetUserId).select("name role");
  if (!targetUser) throw new Error("Target user not found");

  // Timeline: EvidenceRequested — visible to participants so the target sees it
  await writeTimeline({
    disputeId,
    eventType:  "EvidenceRequested",
    actorId:    adminId,
    title:      "Evidence requested",
    description: message,
    payload:    { targetUserId, targetRole: targetUser.role, message },
    visibility: "participants",
  });

  return { disputeId, targetUserId, message, requestedAt: new Date() };
}

/**
 * Delete an evidence record.
 * Only the uploader or an admin can delete.
 */
export async function deleteEvidence(evidenceId, userId, role) {
  if (!objectIdLike(evidenceId)) throw new Error("Invalid evidence ID");

  const evidence = await Evidence.findById(evidenceId);
  if (!evidence) throw new Error("Evidence not found");

  const uploaderStr = evidence.uploadedBy?.toString?.() ?? evidence.uploadedBy?.toString();
  if (role !== "admin" && uploaderStr !== userId.toString()) {
    throw new Error("Access denied");
  }

  // Clean up associated attachments (DB docs + physical / S3 objects)
  if (evidence.attachmentIds && evidence.attachmentIds.length > 0) {
    const attachments = await Attachment.find({ _id: { $in: evidence.attachmentIds } });

    for (const att of attachments) {
      const provider = att.storageProvider || "local";

      if (provider === "s3" && att.storageKey) {
        // New evidence attachments — delete from Storage Engine
        try {
          await storage.delete.one(att.storageKey);
          console.log(`[EVIDENCE] attachment S3 delete success key=${att.storageKey} evidenceId=${evidenceId}`);
        } catch (err) {
          // Non-fatal: DB record removed regardless; log for manual S3 cleanup
          console.warn(`[EVIDENCE] attachment S3 delete warning key=${att.storageKey}: ${err?.message}`);
        }
      } else if (provider === "local" && att.storageKey) {
        // Legacy evidence attachments uploaded before Phase 11C-5 — local filesystem cleanup
        try {
          const { unlink } = await import("fs/promises");
          const { default: path } = await import("path");
          await unlink(path.resolve(process.cwd(), "uploads", "attachments", att.storageKey));
        } catch (_) { /* ignore missing files */ }
      }
      // provider === "link" → no storage object to remove
    }

    await Attachment.deleteMany({ _id: { $in: evidence.attachmentIds } });
  }

  await Evidence.findByIdAndDelete(evidenceId);

  return { deleted: true, evidenceId };
}
