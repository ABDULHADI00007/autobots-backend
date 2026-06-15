import {
  sellerApplicationSchema,
  approveRejectSchema,
} from "./sellerApplication.validation.js";
import {
  createApplication,
  getMyApplication,
  getAllApplications,
  approveApplication,
  rejectApplication,
} from "./sellerApplication.service.js";
import { successResponse, errorResponse } from "../../utils/ApiResponse.js";

export const createApplicationController = async (req, res) => {
  try {
    const data = sellerApplicationSchema.parse(req.body);
    const application = await createApplication(req.user.userId, data);
    return successResponse(res, "Seller application submitted", application, 201);
  } catch (error) {
    if (error.name === "ZodError") {
      return errorResponse(res, error.issues[0]?.message || "Validation failed", 400);
    }
    return errorResponse(res, error.message || "Failed to submit application", 400);
  }
};

export const getMyApplicationController = async (req, res) => {
  try {
    const application = await getMyApplication(req.user.userId);
    return successResponse(res, "Application fetched", application || null, 200);
  } catch (error) {
    return errorResponse(res, error.message || "Failed to fetch application", 400);
  }
};

export const getAllApplicationsController = async (req, res) => {
  try {
    const applications = await getAllApplications();
    return successResponse(res, "Applications fetched", applications, 200);
  } catch (error) {
    return errorResponse(res, error.message || "Failed to fetch applications", 400);
  }
};

export const approveApplicationController = async (req, res) => {
  try {
    const data = approveRejectSchema.parse(req.body || {});
    const application = await approveApplication(req.params.id, data.adminNotes || "");
    return successResponse(res, "Application approved", application, 200);
  } catch (error) {
    if (error.name === "ZodError") {
      return errorResponse(res, error.issues[0]?.message || "Validation failed", 400);
    }
    return errorResponse(res, error.message || "Failed to approve application", 400);
  }
};

export const rejectApplicationController = async (req, res) => {
  try {
    const data = approveRejectSchema.parse(req.body || {});
    const application = await rejectApplication(req.params.id, data.adminNotes || "");
    return successResponse(res, "Application rejected", application, 200);
  } catch (error) {
    if (error.name === "ZodError") {
      return errorResponse(res, error.issues[0]?.message || "Validation failed", 400);
    }
    return errorResponse(res, error.message || "Failed to reject application", 400);
  }
};
