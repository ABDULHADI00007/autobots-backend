import { successResponse, errorResponse } from "../../utils/ApiResponse.js";
import {
  listingCreateSchema,
  listingUpdateSchema,
  listingIdParamSchema,
  listingSlugParamSchema,
  listingQuerySchema,
  listingModerationSchema,
  thumbnailUploadSchema,
  galleryImageUploadSchema,
  galleryReorderSchema,
  demoVideoUploadSchema,
  documentationUploadSchema,
  setupGuideUploadSchema,
} from "./listing.validation.js";
import * as listingService from "./listing.service.js";

const handleError = (res, error, fallbackMessage = "Something went wrong") => {
  if (error.name === "ZodError") {
    return errorResponse(res, error.issues[0]?.message || "Validation failed", 400);
  }

  return errorResponse(res, error.message || fallbackMessage, error.statusCode || 400);
};

export const createListingController = async (req, res) => {
  try {
    const data = listingCreateSchema.parse(req.body);
    const listing = await listingService.createListing(req.user.userId, data);
    return successResponse(res, "Listing created and submitted for approval", listing, 201);
  } catch (error) {
    return handleError(res, error, "Failed to create listing");
  }
};

export const getPublicListingsController = async (req, res) => {
  try {
    const query = listingQuerySchema.parse(req.query);
    const listings = await listingService.getPublicListings(query);
    return successResponse(res, "Listings fetched successfully", listings, 200);
  } catch (error) {
    return handleError(res, error, "Failed to fetch listings");
  }
};

export const getListingBySlugController = async (req, res) => {
  try {
    const { slug } = listingSlugParamSchema.parse(req.params);
    const listing = await listingService.getPublicListingBySlug(slug);
    return successResponse(res, "Listing fetched successfully", listing, 200);
  } catch (error) {
    return handleError(res, error, "Failed to fetch listing");
  }
};

export const getMyListingsController = async (req, res) => {
  try {
    const listings = await listingService.getMyListings(req.user.userId);
    return successResponse(res, "My listings fetched successfully", listings, 200);
  } catch (error) {
    return handleError(res, error, "Failed to fetch my listings");
  }
};

export const updateListingController = async (req, res) => {
  try {
    const { id } = listingIdParamSchema.parse(req.params);
    const data = listingUpdateSchema.parse(req.body);
    const listing = await listingService.updateListing(id, req.user.userId, data);
    return successResponse(res, "Listing updated and submitted for approval", listing, 200);
  } catch (error) {
    return handleError(res, error, "Failed to update listing");
  }
};

export const deleteListingController = async (req, res) => {
  try {
    const { id } = listingIdParamSchema.parse(req.params);
    const listing = await listingService.deleteListing(id, req.user.userId);
    return successResponse(res, "Listing deleted successfully", listing, 200);
  } catch (error) {
    return handleError(res, error, "Failed to delete listing");
  }
};

export const getAllListingsForAdminController = async (req, res) => {
  try {
    const listings = await listingService.getAllListingsForAdmin();
    return successResponse(res, "All listings fetched successfully", listings, 200);
  } catch (error) {
    return handleError(res, error, "Failed to fetch listings");
  }
};

const moderateListingController = async (req, res, action, successMessage) => {
  try {
    const { id } = listingIdParamSchema.parse(req.params);
    const { feedback } = listingModerationSchema.parse(req.body);
    const listing = await listingService.moderateListing(id, action, feedback);
    return successResponse(res, successMessage, listing, 200);
  } catch (error) {
    return handleError(res, error, "Failed to update listing moderation");
  }
};

export const approveListingController = async (req, res) => {
  return moderateListingController(req, res, "approve", "Listing approved successfully");
};

export const rejectListingController = async (req, res) => {
  return moderateListingController(req, res, "reject", "Listing rejected successfully");
};

export const requestChangesListingController = async (req, res) => {
  return moderateListingController(req, res, "request_changes", "Listing marked for changes");
};

export const hideListingController = async (req, res) => {
  return moderateListingController(req, res, "hide", "Listing hidden successfully");
};

export const unhideListingController = async (req, res) => {
  return moderateListingController(req, res, "unhide", "Listing made visible again");
};

// ============================================================
// LISTING MEDIA CONTROLLERS
// Decode base64 body, delegate entirely to listing.service.js.
// All S3 communication goes through the Storage Engine only.
// ============================================================

function decodeUploadBody(body, schema) {
  const parsed = schema.parse(body);
  const raw = parsed.contentBase64.includes(",")
    ? parsed.contentBase64.split(",").pop()
    : parsed.contentBase64;
  const buffer = Buffer.from(raw, "base64");
  return { buffer, mimeType: parsed.mimeType, fileName: parsed.fileName, sizeBytes: parsed.sizeBytes };
}

function storageStatusCode(err) {
  const code = err?.code || "";
  if (code === "STORAGE_VALIDATION_ERROR") return 400;
  if (code === "STORAGE_CONFIG_ERROR")     return 503;
  if (code === "STORAGE_NOT_FOUND")        return 404;
  return err.statusCode || 400;
}

// ── Thumbnail ────────────────────────────────────────────────

export const uploadThumbnailController = async (req, res) => {
  try {
    const { id } = listingIdParamSchema.parse(req.params);
    const file   = decodeUploadBody(req.body, thumbnailUploadSchema);
    const listing = await listingService.updateListingThumbnail(id, req.user.userId, file);
    return successResponse(res, "Thumbnail updated successfully", listing, 200);
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    return errorResponse(res, err.message || "Failed to upload thumbnail", storageStatusCode(err));
  }
};

export const removeThumbnailController = async (req, res) => {
  try {
    const { id } = listingIdParamSchema.parse(req.params);
    const listing = await listingService.deleteListingThumbnail(id, req.user.userId);
    return successResponse(res, "Thumbnail removed successfully", listing, 200);
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    return errorResponse(res, err.message || "Failed to remove thumbnail", storageStatusCode(err));
  }
};

// ── Gallery ─────────────────────────────────────────────────

export const addGalleryImageController = async (req, res) => {
  try {
    const { id } = listingIdParamSchema.parse(req.params);
    const file   = decodeUploadBody(req.body, galleryImageUploadSchema);
    const listing = await listingService.addListingGalleryImage(id, req.user.userId, file);
    return successResponse(res, "Gallery image added successfully", listing, 200);
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    return errorResponse(res, err.message || "Failed to add gallery image", storageStatusCode(err));
  }
};

export const removeGalleryImageController = async (req, res) => {
  try {
    const { id }  = listingIdParamSchema.parse(req.params);
    const { key } = req.body;
    if (!key || typeof key !== "string") {
      return errorResponse(res, "Image key is required", 400);
    }
    const listing = await listingService.removeListingGalleryImage(id, req.user.userId, key);
    return successResponse(res, "Gallery image removed successfully", listing, 200);
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    return errorResponse(res, err.message || "Failed to remove gallery image", storageStatusCode(err));
  }
};

export const reorderGalleryController = async (req, res) => {
  try {
    const { id }  = listingIdParamSchema.parse(req.params);
    const { keys } = galleryReorderSchema.parse(req.body);
    const listing = await listingService.reorderListingGallery(id, req.user.userId, keys);
    return successResponse(res, "Gallery reordered successfully", listing, 200);
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    return errorResponse(res, err.message || "Failed to reorder gallery", storageStatusCode(err));
  }
};

// ── Media (Phase 11F) ───────────────────────────────────────────────

const MEDIA_SCHEMA_MAP = {
  demoVideo:     demoVideoUploadSchema,
  documentation: documentationUploadSchema,
  setupGuide:    setupGuideUploadSchema,
};

export const uploadListingMediaController = async (req, res) => {
  try {
    const { id, mediaType } = req.params;
    listingIdParamSchema.parse({ id });
    const schema = MEDIA_SCHEMA_MAP[mediaType];
    if (!schema) return errorResponse(res, "Invalid media type", 400);

    const file = decodeUploadBody(req.body, schema);
    const listing = await listingService.uploadListingMedia(id, req.user.userId, mediaType, file);
    return successResponse(res, `${mediaType} uploaded successfully`, listing, 200);
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    return errorResponse(res, err.message || "Failed to upload media", storageStatusCode(err));
  }
};

export const deleteListingMediaController = async (req, res) => {
  try {
    const { id, mediaType } = req.params;
    listingIdParamSchema.parse({ id });
    if (!MEDIA_SCHEMA_MAP[mediaType]) return errorResponse(res, "Invalid media type", 400);

    const listing = await listingService.deleteListingMedia(id, req.user.userId, mediaType);
    return successResponse(res, `${mediaType} removed successfully`, listing, 200);
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    return errorResponse(res, err.message || "Failed to remove media", storageStatusCode(err));
  }
};
