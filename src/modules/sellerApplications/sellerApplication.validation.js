import { z } from "zod";

export const sellerApplicationSchema = z.object({
  portfolio: z.string().trim().min(1, "Portfolio is required"),
  experience: z.string().trim().min(1, "Experience is required"),
  linkedin: z.string().trim().optional().or(z.literal("")),
  website: z.string().trim().optional().or(z.literal("")),
});

export const approveRejectSchema = z.object({
  adminNotes: z.string().trim().optional().or(z.literal("")),
});

// ============================================================
// SELLER APPLICATION DOCUMENT UPLOAD VALIDATION
// ============================================================

const MAX_IDENTITY_BYTES  = 10 * 1024 * 1024; // 10 MB
const MAX_PORTFOLIO_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_SUPPORT_BYTES   = 25 * 1024 * 1024; // 25 MB per doc
const MAX_SUPPORT_DOCS    = 5;

const IDENTITY_MIME_TYPES = [
  "image/jpeg", "image/png", "image/webp",
  "application/pdf",
];

const PORTFOLIO_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "application/x-zip-compressed",
];

const SUPPORT_MIME_TYPES = [
  "image/jpeg", "image/png", "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const IDENTITY_DOC_TYPES = ["cnic", "passport", "national_id", "other"];

function docUploadSchema(allowedMimes, maxBytes, label) {
  return z.object({
    fileName:      z.string().trim().min(1, `${label} file name is required`),
    mimeType:      z.enum(allowedMimes, { errorMap: () => ({ message: `${label} file type is not supported` }) }),
    sizeBytes:     z.number().int().min(1, "File must not be empty").max(maxBytes, `${label} must not exceed ${Math.round(maxBytes / (1024 * 1024))} MB`),
    contentBase64: z.string().min(1, "File content is required"),
  });
}

export const identityDocUploadSchema = docUploadSchema(IDENTITY_MIME_TYPES, MAX_IDENTITY_BYTES, "Identity document")
  .extend({
    docType: z.enum(IDENTITY_DOC_TYPES, { errorMap: () => ({ message: "Document type must be cnic, passport, national_id, or other" }) }),
  });

export const portfolioFileUploadSchema = docUploadSchema(PORTFOLIO_MIME_TYPES, MAX_PORTFOLIO_BYTES, "Portfolio file");

export const supportingDocUploadSchema = docUploadSchema(SUPPORT_MIME_TYPES, MAX_SUPPORT_BYTES, "Supporting document")
  .extend({
    label: z.string().trim().min(1, "Document label is required").max(100, "Label must not exceed 100 characters"),
  });

export const removeDocSchema = z.object({
  key: z.string().min(1, "Document key is required"),
});

export { MAX_SUPPORT_DOCS };
