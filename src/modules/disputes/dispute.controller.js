import { createDisputeSchema, adminResolveSchema, adminResolutionSchema } from "./dispute.validation.js";
import * as disputeService from "./dispute.service.js";
import { successResponse, errorResponse } from "../../utils/ApiResponse.js";

export const createDisputeController = async (req, res) => {
  try {
    const data = createDisputeSchema.parse(req.body);
    const dispute = await disputeService.createDispute({
      orderId: data.orderId,
      openerId: req.user.userId,
      openerRole: req.user.role,
      reason: data.reason,
    });
    return successResponse(res, "Dispute created", dispute, 201);
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    return errorResponse(res, err.message, 400);
  }
};

export const getMyDisputesController = async (req, res) => {
  try {
    const disputes = await disputeService.getMyDisputes(req.user.userId, req.user.role);
    return successResponse(res, "Disputes fetched", disputes, 200);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const getAllDisputesController = async (req, res) => {
  try {
    const disputes = await disputeService.getAllDisputes();
    return successResponse(res, "All disputes fetched", disputes, 200);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const resolveDisputeController = async (req, res) => {
  try {
    const data = adminResolveSchema.parse(req.body);
    const dispute = await disputeService.resolveDispute(
      req.params.id,
      data.decision,
      data.adminNotes || "",
      req.user.userId
    );
    return successResponse(res, "Dispute resolved", dispute, 200);
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    return errorResponse(res, err.message, 400);
  }
};

export const resolveDisputeFinalController = async (req, res) => {
  try {
    const data = adminResolutionSchema.parse(req.body);
    const dispute = await disputeService.resolveDisputeFinal(
      req.params.id,
      data.decision,
      data.notes,
      req.user.userId
    );
    return successResponse(res, "Dispute resolved", dispute, 200);
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    const status = err.message === "Dispute already resolved" ? 409 : 400;
    return errorResponse(res, err.message, status);
  }
};
