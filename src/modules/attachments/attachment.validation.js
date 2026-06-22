import { z } from "zod";

const objectIdRegex = /^[a-f\d]{24}$/i;

export const attachmentParentTypes = ["message", "delivery", "evidence"];
export const attachmentVisibilities = ["participants", "admin", "internal"];
export const attachmentKinds = ["file", "link", "image", "video", "document", "archive", "other"];

export const createAttachmentSchema = z.object({
  parentType: z.enum(attachmentParentTypes),
  parentId: z.string().regex(objectIdRegex, "Invalid parent ID"),
  fileName: z.string().trim().min(1, "File name is required"),
  mimeType: z.string().trim().min(1, "MIME type is required"),
  sizeBytes: z.number().int().min(0, "Invalid file size"),
  checksum: z.string().trim().min(1, "Checksum is required"),
  visibility: z.enum(attachmentVisibilities).optional().default("participants"),
  kind: z.enum(attachmentKinds).optional().default("file"),
  contentBase64: z.string().trim().min(1, "File content is required").optional(),
  externalUrl: z.string().url("Invalid external URL").optional(),
}).refine(
  (value) => (value.kind === "link" ? Boolean(value.externalUrl) : Boolean(value.contentBase64)),
  {
    message: "File content or external URL is required",
    path: ["contentBase64"],
  }
);

export const attachmentIdSchema = z.object({
  attachmentId: z.string().regex(objectIdRegex, "Invalid attachment ID"),
});

export const listAttachmentsSchema = z.object({
  parentType: z.enum(attachmentParentTypes).optional(),
  parentId: z.string().regex(objectIdRegex, "Invalid parent ID").optional(),
  uploaderId: z.string().regex(objectIdRegex, "Invalid uploader ID").optional(),
});