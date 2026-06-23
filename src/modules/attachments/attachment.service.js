import mongoose from "mongoose";
import { createHash } from "crypto";
import { access, mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import Attachment from "./attachment.model.js";
import Message from "../conversations/message.model.js";
import ConversationParticipant from "../conversations/conversationParticipant.model.js";
import Delivery from "../deliveries/delivery.model.js";
import Order from "../orders/order.model.js";
import Investigation from "../investigations/investigation.model.js";
import Evidence from "../evidence/evidence.model.js";
import Dispute from "../disputes/dispute.model.js";

export const ATTACHMENT_SIZE_LIMITS = {
  image: 25 * 1024 * 1024,
  document: 25 * 1024 * 1024,
  archive: 100 * 1024 * 1024,
  video: 250 * 1024 * 1024,
  link: 0,
};

const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];
const ARCHIVE_MIME_TYPES = ["application/zip", "application/x-zip-compressed", "application/x-zip"];
const VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime"];
const ATTACHMENT_STORAGE_ROOT = path.resolve(process.cwd(), "uploads", "attachments");

export const SUPPORTED_ATTACHMENT_MIME_TYPES = [
  ...IMAGE_MIME_TYPES,
  ...DOCUMENT_MIME_TYPES,
  ...ARCHIVE_MIME_TYPES,
  ...VIDEO_MIME_TYPES,
  "text/uri-list",
];

const objectIdLike = (value) => mongoose.Types.ObjectId.isValid(value);

function normalizeUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  return value;
}

function resolveAttachmentKind(mimeType, kind) {
  if (kind && kind !== "file") return kind;
  if (IMAGE_MIME_TYPES.includes(mimeType)) return "image";
  if (DOCUMENT_MIME_TYPES.includes(mimeType)) return "document";
  if (ARCHIVE_MIME_TYPES.includes(mimeType)) return "archive";
  if (VIDEO_MIME_TYPES.includes(mimeType)) return "video";
  if (mimeType === "text/uri-list") return "link";
  return "other";
}

function resolveSizeLimit(kind, mimeType) {
  if (kind === "link" || mimeType === "text/uri-list") return ATTACHMENT_SIZE_LIMITS.link;
  if (IMAGE_MIME_TYPES.includes(mimeType)) return ATTACHMENT_SIZE_LIMITS.image;
  if (DOCUMENT_MIME_TYPES.includes(mimeType)) return ATTACHMENT_SIZE_LIMITS.document;
  if (ARCHIVE_MIME_TYPES.includes(mimeType)) return ATTACHMENT_SIZE_LIMITS.archive;
  if (VIDEO_MIME_TYPES.includes(mimeType)) return ATTACHMENT_SIZE_LIMITS.video;
  return null;
}

function isTextBuffer(buffer) {
  if (!buffer || buffer.length === 0) return false;

  const sample = buffer.slice(0, 512);
  for (const byte of sample) {
    if (byte === 0) return false;
  }

  return true;
}

function detectMimeType(buffer) {
  if (!buffer || buffer.length < 4) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.slice(0, 4).toString("ascii") === "RIFF" && buffer.slice(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buffer.slice(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (buffer.slice(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) return "application/zip";
  if (buffer.length >= 12 && buffer.slice(4, 8).toString("ascii") === "ftyp") return "video/mp4";
  if (isTextBuffer(buffer)) return "text/plain";
  return null;
}

function mimeTypesMatch(declaredMimeType, actualMimeType) {
  if (declaredMimeType === actualMimeType) return true;
  if (declaredMimeType.startsWith("image/") && actualMimeType.startsWith("image/")) return true;

  const equivalent = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["application/zip"],
    "application/msword": ["application/zip"],
    "application/zip": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"],
  };

  return equivalent[declaredMimeType]?.includes(actualMimeType) ?? false;
}

function sanitizeFileName(fileName) {
  return (
    String(fileName || "attachment")
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "attachment"
  );
}

function decodeBase64Content(contentBase64) {
  const value = String(contentBase64 || "").trim();
  if (!value) return null;
  const raw = value.includes(",") ? value.split(",").pop() : value;
  return Buffer.from(raw, "base64");
}

async function ensureStorageDir() {
  await mkdir(ATTACHMENT_STORAGE_ROOT, { recursive: true });
}

function checksumOfBuffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function assertSupportedAttachment({ kind, mimeType, sizeBytes, externalUrl }) {
  const normalizedUrl = normalizeUrl(externalUrl);
  const resolvedKind = resolveAttachmentKind(mimeType, kind);
  const limit = resolveSizeLimit(resolvedKind, mimeType);

  if (resolvedKind === "link") {
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      throw new Error("Link attachments must use an external http(s) URL");
    }
    return { kind: resolvedKind, sizeLimit: ATTACHMENT_SIZE_LIMITS.link };
  }

  if (limit === null) {
    throw new Error("Unsupported file type");
  }

  if (!SUPPORTED_ATTACHMENT_MIME_TYPES.includes(mimeType) && resolvedKind !== "other") {
    throw new Error("Unsupported file type");
  }

  if (typeof sizeBytes === "number" && sizeBytes > limit) {
    throw new Error("File exceeds the allowed size limit");
  }

  return { kind: resolvedKind, sizeLimit: limit };
}

async function isOrderParticipant(order, userId) {
  if (!order) return false;
  const buyerId = order.buyerId?._id ?? order.buyerId;
  const sellerId = order.sellerId?._id ?? order.sellerId;
  return buyerId?.toString?.() === userId || sellerId?.toString?.() === userId;
}

async function canAccessMessageAttachment(parentId, userId) {
  const message = await Message.findById(parentId).select("conversationId");
  if (!message) return false;
  const participant = await ConversationParticipant.findOne({ conversationId: message.conversationId, userId });
  return Boolean(participant);
}

async function canAccessDeliveryAttachment(parentId, userId) {
  const delivery = await Delivery.findById(parentId).select("orderId");
  if (!delivery) return false;
  const order = await Order.findById(delivery.orderId).select("buyerId sellerId");
  return isOrderParticipant(order, userId);
}

async function canAccessEvidenceAttachment(parentId, userId, role) {
  // parentId may be an evidenceId (after re-parenting) or a disputeId (pre-creation)
  const evidence = await (await import("../evidence/evidence.model.js")).default.findById(parentId).select("disputeId visibility attachmentIds");
  if (evidence) {
    // Non-admins cannot access attachments belonging to admin-only or internal-only evidence
    if (role !== "admin" && evidence.visibility !== "participant-visible") return false;

    const dispute = await Dispute.findById(evidence.disputeId).select("orderId");
    if (!dispute) return false;
    const order = await Order.findById(dispute.orderId).select("buyerId sellerId");
    return isOrderParticipant(order, userId);
  }

  // Fallback: parentId is a disputeId (attachment not yet re-parented to an evidence doc)
  const dispute = await Dispute.findById(parentId).select("orderId");
  if (!dispute) return false;
  const order = await Order.findById(dispute.orderId).select("buyerId sellerId");
  return isOrderParticipant(order, userId);
}

async function canAccessAttachment(attachment, userId, role) {
  if (!attachment) return false;
  if (role === "admin") return true;

  const uploaderId = attachment.uploaderId?._id ?? attachment.uploaderId;
  if (uploaderId?.toString?.() === userId) return true;

  if (attachment.parentType === "message") {
    return canAccessMessageAttachment(attachment.parentId, userId);
  }

  if (attachment.parentType === "delivery") {
    return canAccessDeliveryAttachment(attachment.parentId, userId);
  }

  if (attachment.parentType === "evidence") {
    return canAccessEvidenceAttachment(attachment.parentId, userId, role);
  }

  return false;
}

async function assertParentAccess(parentType, parentId, userId, role) {
  if (role === "admin") return;

  if (parentType === "message") {
    const allowed = await canAccessMessageAttachment(parentId, userId);
    if (!allowed) throw new Error("Access denied");
    return;
  }

  if (parentType === "delivery") {
    if (role === "buyer") throw new Error("Buyers cannot upload delivery attachments");
    const allowed = await canAccessDeliveryAttachment(parentId, userId);
    if (!allowed) throw new Error("Access denied");
    return;
  }

  if (parentType === "evidence") {
    // Verify the parentId is a valid dispute (pre-evidence-creation upload) or evidence document.
    // Block uploads if the dispute is already resolved for either case.
    const evidenceDoc = await Evidence.findById(parentId).select("disputeId");
    if (evidenceDoc) {
      const resolvedDispute = await Dispute.findById(evidenceDoc.disputeId).select("status");
      if (resolvedDispute?.status === "resolved") {
        throw new Error("Cannot upload attachments to evidence in a resolved dispute");
      }
    } else {
      const disputeDoc = await Dispute.findById(parentId).select("orderId status");
      const isDisputeId = Boolean(disputeDoc);
      if (isDisputeId && disputeDoc.status === "resolved") {
        throw new Error("Cannot upload evidence to a resolved dispute");
      }
    }

    const allowed = await canAccessEvidenceAttachment(parentId, userId, role);
    if (!allowed) throw new Error("Access denied");
    return;
  }

  throw new Error("Access denied");
}

function toAttachmentPayload(attachment) {
  return {
    _id: attachment._id,
    parentType: attachment.parentType,
    parentId: attachment.parentId,
    uploaderId: attachment.uploaderId,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    checksum: attachment.checksum,
    storageProvider: attachment.storageProvider,
    storageKey: attachment.storageKey,
    url: attachment.url,
    visibility: attachment.visibility,
    kind: attachment.kind,
    createdAt: attachment.createdAt,
    updatedAt: attachment.updatedAt,
  };
}

export async function createAttachment({
  parentType,
  parentId,
  uploaderId,
  role,
  fileName,
  mimeType,
  sizeBytes,
  checksum,
  contentBase64,
  externalUrl,
  visibility,
  kind,
}) {
  if (!objectIdLike(parentId)) {
    throw new Error("Invalid parent ID");
  }

  const { kind: resolvedKind } = assertSupportedAttachment({ kind, mimeType, sizeBytes, externalUrl });
  await assertParentAccess(parentType, parentId, uploaderId, role);

  const normalizedKind = resolvedKind;
  let storageProvider = "local";
  let storageKey = "";
  let url = "";

  if (normalizedKind === "link") {
    storageProvider = "link";
    storageKey = `link-${checksum}`;
    url = externalUrl;
  } else {
    const contentBuffer = decodeBase64Content(contentBase64);
    if (!contentBuffer) {
      throw new Error("File content is required");
    }

    if (typeof sizeBytes === "number" && contentBuffer.length !== sizeBytes) {
      throw new Error("File size mismatch");
    }

    const computedChecksum = checksumOfBuffer(contentBuffer);
    if (computedChecksum !== checksum) {
      throw new Error("Checksum mismatch");
    }

    const actualMimeType = detectMimeType(contentBuffer);
    if (!actualMimeType) {
      throw new Error("Unable to verify uploaded file type");
    }

    if (!mimeTypesMatch(mimeType, actualMimeType)) {
      throw new Error("Declared MIME type does not match file content");
    }

    await ensureStorageDir();
    const safeName = sanitizeFileName(fileName);
    const extension = path.extname(safeName);
    storageKey = `${computedChecksum}${extension || ""}`;
    const storagePath = path.join(ATTACHMENT_STORAGE_ROOT, storageKey);
    const existingFile = await access(storagePath).then(() => true).catch(() => false);
    let wroteNewFile = false;

    try {
      if (!existingFile) {
        await writeFile(storagePath, contentBuffer);
        wroteNewFile = true;
      }
      url = `/uploads/attachments/${storageKey}`;
    } catch (err) {
      if (wroteNewFile) {
        await unlink(storagePath).catch(() => {});
      }
      throw err;
    }

    let attachment;
    try {
      attachment = await Attachment.create({
        parentType,
        parentId,
        uploaderId,
        fileName,
        mimeType,
        sizeBytes,
        checksum,
        storageKey,
        url,
        storageProvider,
        visibility: visibility || "participants",
        kind: normalizedKind,
      });
    } catch (err) {
      if (wroteNewFile) {
        await unlink(storagePath).catch(() => {});
      }
      throw err;
    }

    return toAttachmentPayload(attachment);
  }
}

export async function getAttachment(attachmentId, userId, role) {
  if (!objectIdLike(attachmentId)) {
    throw new Error("Invalid attachment ID");
  }

  const attachment = await Attachment.findById(attachmentId);
  if (!attachment) throw new Error("Attachment not found");

  const allowed = await canAccessAttachment(attachment, userId, role);
  if (!allowed) throw new Error("Access denied");

  return toAttachmentPayload(attachment);
}

export async function listAttachments({ userId, role, parentType, parentId, uploaderId }) {
  const query = {};

  if (parentType) query.parentType = parentType;
  if (parentId) query.parentId = parentId;

  if (role === "admin") {
    if (uploaderId) query.uploaderId = uploaderId;
  } else if (parentType && parentId) {
    await assertParentAccess(parentType, parentId, userId, role);
  } else {
    query.uploaderId = userId;
    if (parentType) query.parentType = parentType;
  }

  const attachments = await Attachment.find(query).sort({ createdAt: -1 });
  return attachments.map(toAttachmentPayload);
}

export async function deleteAttachment(attachmentId, userId, role) {
  if (!objectIdLike(attachmentId)) {
    throw new Error("Invalid attachment ID");
  }

  const attachment = await Attachment.findById(attachmentId);
  if (!attachment) throw new Error("Attachment not found");

  const uploaderId = attachment.uploaderId?._id ?? attachment.uploaderId;
  const isOwner = uploaderId?.toString?.() === userId;
  if (role !== "admin" && !isOwner) {
    throw new Error("Access denied");
  }

  const storageProvider = attachment.storageProvider || "local";
  if (storageProvider === "local" && attachment.storageKey) {
    try {
      await unlink(path.join(ATTACHMENT_STORAGE_ROOT, attachment.storageKey));
    } catch (_err) {
      // Ignore missing files during metadata cleanup.
    }
  }

  await Attachment.findByIdAndDelete(attachmentId);
  return toAttachmentPayload(attachment);
}

export async function getAttachmentsForParent(parentType, parentId) {
  if (!objectIdLike(parentId)) return [];
  const attachments = await Attachment.find({ parentType, parentId }).sort({ createdAt: 1 });
  return attachments.map(toAttachmentPayload);
}
