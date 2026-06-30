import mongoose from "mongoose";
import { z } from "zod";

const objectId = z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
  message: "Invalid id",
});

const optionalText = z.string().trim().optional().or(z.literal(""));

export const listingCreateSchema = z.object({
  categoryId: objectId,
  title: z.string().trim().min(1, "Title is required"),
  outcome: z.string().trim().min(1, "Outcome is required"),
  shortDescription: z.string().trim().min(1, "Short description is required"),
  fullDescription: z.string().trim().min(1, "Full description is required"),
  difficultyLevel: z.enum(["easy", "moderate", "advanced"], {
    message: "Difficulty level must be easy, moderate, or advanced",
  }),
  requiredTools: z.array(z.string().trim().min(1)).optional(),
  monthlySoftwareCost: z.number().min(0, "Monthly software cost must be positive").optional(),
  price: z.number().positive("Price must be positive"),
  estimatedOutcomes: optionalText,
  deliverables: z.array(z.string().trim().min(1)).optional(),
});

export const listingUpdateSchema = listingCreateSchema.partial();

export const listingModerationSchema = z.object({
  feedback: z.string().trim().optional().default(""),
});

export const listingIdParamSchema = z.object({
  id: objectId,
});

export const listingSlugParamSchema = z.object({
  slug: z.string().trim().min(1, "Slug is required"),
});

export const listingQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  difficulty: z.enum(["easy", "moderate", "advanced"]).optional(),
  verificationStatus: z.enum(["verified", "unverified"]).optional(),
});

// ============================================================
// LISTING MEDIA UPLOAD VALIDATION
// ============================================================

const MAX_THUMBNAIL_BYTES = 8  * 1024 * 1024; // 8 MB
const MAX_GALLERY_BYTES   = 10 * 1024 * 1024; // 10 MB per image
const MAX_GALLERY_IMAGES  = 10;

const LISTING_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];

function imageUploadSchema(maxBytes, label) {
  return z.object({
    fileName:      z.string().trim().min(1, `${label} file name is required`),
    mimeType:      z.enum(LISTING_IMAGE_MIMES, { errorMap: () => ({ message: `${label} must be JPEG, PNG or WebP` }) }),
    sizeBytes:     z.number().int().min(1, "File must not be empty").max(maxBytes, `${label} must not exceed ${Math.round(maxBytes / (1024 * 1024))} MB`),
    contentBase64: z.string().min(1, "File content is required"),
  });
}

export const thumbnailUploadSchema = imageUploadSchema(MAX_THUMBNAIL_BYTES, "Thumbnail");
export const galleryImageUploadSchema = imageUploadSchema(MAX_GALLERY_BYTES, "Gallery image");

export const galleryReorderSchema = z.object({
  keys: z.array(z.string().min(1)).min(1, "At least one key is required").max(MAX_GALLERY_IMAGES, `Gallery cannot exceed ${MAX_GALLERY_IMAGES} images`),
});

export const MAX_GALLERY_SIZE = MAX_GALLERY_IMAGES;

// ============================================================
// LISTING MEDIA UPLOAD VALIDATION (Phase 11F)
// ============================================================

const MAX_DEMO_VIDEO_BYTES    = 250 * 1024 * 1024; // 250 MB
const MAX_DOCUMENTATION_BYTES =  25 * 1024 * 1024; //  25 MB
const MAX_SETUP_GUIDE_BYTES   =  25 * 1024 * 1024; //  25 MB

const DEMO_VIDEO_MIMES    = ["video/mp4", "video/webm", "video/quicktime"];
const DOCUMENTATION_MIMES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];
const SETUP_GUIDE_MIMES   = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "application/x-zip-compressed",
  "text/plain",
];

function mediaUploadSchema(allowedMimes, maxBytes, label) {
  return z.object({
    fileName:      z.string().trim().min(1, `${label} file name is required`),
    mimeType:      z.enum(allowedMimes, { errorMap: () => ({ message: `${label}: unsupported file type` }) }),
    sizeBytes:     z.number().int().min(1, "File must not be empty").max(maxBytes, `${label} exceeds the size limit`),
    contentBase64: z.string().min(1, "File content is required"),
  });
}

export const demoVideoUploadSchema    = mediaUploadSchema(DEMO_VIDEO_MIMES,    MAX_DEMO_VIDEO_BYTES,    "Demo Video");
export const documentationUploadSchema = mediaUploadSchema(DOCUMENTATION_MIMES, MAX_DOCUMENTATION_BYTES, "Documentation");
export const setupGuideUploadSchema    = mediaUploadSchema(SETUP_GUIDE_MIMES,   MAX_SETUP_GUIDE_BYTES,   "Setup Guide");

export const DEMO_VIDEO_MIME_TYPES    = DEMO_VIDEO_MIMES;
export const DOCUMENTATION_MIME_TYPES = DOCUMENTATION_MIMES;
export const SETUP_GUIDE_MIME_TYPES   = SETUP_GUIDE_MIMES;
