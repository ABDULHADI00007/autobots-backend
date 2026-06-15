import { successResponse, errorResponse } from "../../utils/ApiResponse.js";
import { createReviewSchema, updateReviewSchema } from "./review.validation.js";
import * as reviewService from "./review.service.js";

export const createReview = async (req, res) => {
  try {
    const data = createReviewSchema.parse(req.body);
    const review = await reviewService.createReview(req.user.userId, data);
    return successResponse(res, "Review submitted successfully", review, 201);
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    return errorResponse(res, err.message, 400);
  }
};

export const getListingReviews = async (req, res) => {
  try {
    const reviews = await reviewService.getListingReviews(req.params.listingId);
    return successResponse(res, "Reviews fetched successfully", reviews);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const getMyReviews = async (req, res) => {
  try {
    const reviews = await reviewService.getMyReviews(req.user.userId);
    return successResponse(res, "My reviews fetched successfully", reviews);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const getAllReviews = async (req, res) => {
  try {
    const reviews = await reviewService.getAllReviews();
    return successResponse(res, "All reviews fetched successfully", reviews);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const updateReview = async (req, res) => {
  try {
    const data = updateReviewSchema.parse(req.body);
    const review = await reviewService.updateReview(req.params.id, req.user.userId, data);
    return successResponse(res, "Review updated successfully", review);
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    return errorResponse(res, err.message, 400);
  }
};

export const deleteReview = async (req, res) => {
  try {
    await reviewService.deleteReview(req.params.id, req.user.userId);
    return successResponse(res, "Review deleted successfully", null);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};
