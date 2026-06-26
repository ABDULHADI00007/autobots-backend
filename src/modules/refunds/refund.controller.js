import { successResponse, errorResponse } from "../../utils/ApiResponse.js";
import { createRefundSchema, adminNotesSchema } from "./refund.validation.js";
import * as refundService from "./refund.service.js";

export const createRefund = async (req, res) => {
  try {
    const data = createRefundSchema.parse(req.body);
    const refund = await refundService.createRefund(req.user.userId, data);
    return successResponse(res, "Refund request submitted successfully", refund, 201);
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    return errorResponse(res, err.message, 400);
  }
};

export const getMyRefunds = async (req, res) => {
  try {
    const refunds = await refundService.getMyRefunds(req.user.userId);
    return successResponse(res, "Refund requests fetched successfully", refunds);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const getAllRefunds = async (req, res) => {
  try {
    const refunds = await refundService.getAllRefunds({
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      status: req.query.status,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
    });
    return successResponse(res, "All refund requests fetched successfully", refunds);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const getRefundById = async (req, res) => {
  try {
    const refund = await refundService.getRefundById(req.params.id);
    return successResponse(res, "Refund request fetched successfully", refund);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const approveRefund = async (req, res) => {
  try {
    const { adminNotes } = adminNotesSchema.parse(req.body);
    const refund = await refundService.approveRefund(req.params.id, adminNotes);
    return successResponse(res, "Refund approved successfully", refund);
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    return errorResponse(res, err.message, 400);
  }
};

export const rejectRefund = async (req, res) => {
  try {
    const { adminNotes } = adminNotesSchema.parse(req.body);
    const refund = await refundService.rejectRefund(req.params.id, adminNotes);
    return successResponse(res, "Refund rejected successfully", refund);
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    return errorResponse(res, err.message, 400);
  }
};
