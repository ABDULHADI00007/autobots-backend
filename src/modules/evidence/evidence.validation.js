import { z } from "zod";

const objectIdRegex = /^[a-f\d]{24}$/i;
const objectId = z.string().regex(objectIdRegex, "Invalid ID");

export const evidenceSourceTypes = [
  "screenshot",
  "document",
  "video",
  "archive",
  "chat_export",
  "delivery_export",
  "external_link",
  "other",
];

export const evidenceVisibilities = [
  "participant-visible",
  "admin-only",
  "internal-only",
];

// POST /disputes/:disputeId/evidence
export const createEvidenceSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().trim().max(2000, "Description too long").optional().default(""),
  sourceType: z.enum(evidenceSourceTypes).optional().default("other"),
  // admin can set admin-only or internal-only; participants default to participant-visible
  visibility: z.enum(evidenceVisibilities).optional().default("participant-visible"),
  // Array of already-uploaded Attachment _ids (parentType="evidence" set during attach)
  attachmentIds: z.array(objectId).optional().default([]),
});

// POST /evidence/:id/request  — admin requests evidence from a participant
export const requestEvidenceSchema = z.object({
  targetUserId: objectId,
  message: z.string().trim().min(5, "Message must be at least 5 characters").max(1000),
});

// POST /evidence/:id/verify  — admin marks an evidence record as verified
export const verifyEvidenceSchema = z.object({
  // no body fields required — actor comes from req.user
});

export const evidenceIdParamSchema = z.object({
  id: objectId,
});

export const disputeIdParamSchema = z.object({
  disputeId: objectId,
});
