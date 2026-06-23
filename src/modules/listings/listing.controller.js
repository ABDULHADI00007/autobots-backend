import { successResponse, errorResponse } from "../../utils/ApiResponse.js";
import {
  listingCreateSchema,
  listingUpdateSchema,
  listingIdParamSchema,
  listingSlugParamSchema,
  listingQuerySchema,
  listingModerationSchema,
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
