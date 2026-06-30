import { z } from "zod";

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
});

// ============================================================
// MEDIA UPLOAD VALIDATION
// Validates the JSON body sent to avatar/logo/banner endpoints.
// Files arrive as base64 with declared metadata.
// ============================================================

const MAX_AVATAR_BYTES  = 5  * 1024 * 1024; // 5 MB
const MAX_LOGO_BYTES    = 5  * 1024 * 1024; // 5 MB
const MAX_BANNER_BYTES  = 8  * 1024 * 1024; // 8 MB

const AVATAR_MIME_TYPES  = ["image/jpeg", "image/png", "image/webp"];
const LOGO_MIME_TYPES    = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
const BANNER_MIME_TYPES  = ["image/jpeg", "image/png", "image/webp"];

function mediaUploadSchema(allowedMimes, maxBytes, label) {
  return z.object({
    fileName:     z.string().trim().min(1, `${label} file name is required`),
    mimeType:     z.enum(allowedMimes, { errorMap: () => ({ message: `${label} must be ${allowedMimes.join(" or ")}` }) }),
    sizeBytes:    z.number().int().min(1, "File must not be empty").max(maxBytes, `${label} must not exceed ${Math.round(maxBytes / (1024 * 1024))} MB`),
    contentBase64: z.string().min(1, "File content is required"),
  });
}

export const avatarUploadSchema  = mediaUploadSchema(AVATAR_MIME_TYPES,  MAX_AVATAR_BYTES,  "Avatar");
export const logoUploadSchema    = mediaUploadSchema(LOGO_MIME_TYPES,    MAX_LOGO_BYTES,    "Logo");
export const bannerUploadSchema  = mediaUploadSchema(BANNER_MIME_TYPES,  MAX_BANNER_BYTES,  "Banner");

export const buyerAdminNoteSchema = z.object({
  note: z.string().trim().min(1, "Note is required"),
});

export const buyerSuspendSchema = z.object({
  reason: z.string().trim().optional().default(""),
});

export const buyerAdminListSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().optional().default(""),
  status: z.enum(["all", "active", "suspended"]).optional().default("all"),
  risk: z.union([z.string(), z.array(z.string())]).optional(),
  sortBy: z.enum(["name", "email", "createdAt", "totalOrders", "totalSpend", "disputesOpened", "refundCount"]).optional().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
}).transform((data) => ({
  ...data,
  risk: Array.isArray(data.risk)
    ? data.risk
    : typeof data.risk === "string"
      ? data.risk.split(",").map((value) => value.trim()).filter(Boolean)
      : [],
}));

export const roleUpdateSchema = z.object({
  role: z.enum(["buyer", "seller"], {
    errorMap: () => ({ message: "Role must be buyer or seller" }),
  }),
});
