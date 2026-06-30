import {
  sellerApplicationSchema,
  approveRejectSchema,
  identityDocUploadSchema,
  portfolioFileUploadSchema,
  supportingDocUploadSchema,
  removeDocSchema,
} from "./sellerApplication.validation.js";
import {
  createApplication,
  getMyApplication,
  getAllApplications,
  approveApplication,
  rejectApplication,
  uploadIdentityDocument,
  removeIdentityDocument,
  uploadPortfolioFile,
  removePortfolioFile,
  addSupportingDocument,
  removeSupportingDocument,
} from "./sellerApplication.service.js";
import { successResponse, errorResponse } from "../../utils/ApiResponse.js";

// ============================================================
// EXISTING CONTROLLERS (unchanged)
// ============================================================

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

// ============================================================
// DOCUMENT UPLOAD CONTROLLERS
// Decode base64 body, delegate entirely to service.
// All S3 communication goes through the Storage Engine only.
// ============================================================

function decodeUploadBody(body, schema) {
  const parsed = schema.parse(body);
  const raw = parsed.contentBase64.includes(",")
    ? parsed.contentBase64.split(",").pop()
    : parsed.contentBase64;
  const buffer = Buffer.from(raw, "base64");
  return { ...parsed, buffer };
}

function storageStatusCode(err) {
  const code = err?.code || "";
  if (code === "STORAGE_VALIDATION_ERROR") return 400;
  if (code === "STORAGE_CONFIG_ERROR")     return 503;
  if (code === "STORAGE_NOT_FOUND")        return 404;
  return err.statusCode || 400;
}

// ── Identity Document ──────────────────────────────────────

export const uploadIdentityDocController = async (req, res) => {
  try {
    const file = decodeUploadBody(req.body, identityDocUploadSchema);
    const application = await uploadIdentityDocument(req.user.userId, file);
    return successResponse(res, "Identity document uploaded successfully", application, 200);
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    return errorResponse(res, err.message || "Failed to upload identity document", storageStatusCode(err));
  }
};

export const removeIdentityDocController = async (req, res) => {
  try {
    const application = await removeIdentityDocument(req.user.userId);
    return successResponse(res, "Identity document removed successfully", application, 200);
  } catch (err) {
    return errorResponse(res, err.message || "Failed to remove identity document", storageStatusCode(err));
  }
};

// ── Portfolio File ─────────────────────────────────────────

export const uploadPortfolioFileController = async (req, res) => {
  try {
    const file = decodeUploadBody(req.body, portfolioFileUploadSchema);
    const application = await uploadPortfolioFile(req.user.userId, file);
    return successResponse(res, "Portfolio file uploaded successfully", application, 200);
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    return errorResponse(res, err.message || "Failed to upload portfolio file", storageStatusCode(err));
  }
};

export const removePortfolioFileController = async (req, res) => {
  try {
    const application = await removePortfolioFile(req.user.userId);
    return successResponse(res, "Portfolio file removed successfully", application, 200);
  } catch (err) {
    return errorResponse(res, err.message || "Failed to remove portfolio file", storageStatusCode(err));
  }
};

// ── Supporting Documents ───────────────────────────────────

export const addSupportingDocController = async (req, res) => {
  try {
    const file = decodeUploadBody(req.body, supportingDocUploadSchema);
    const application = await addSupportingDocument(req.user.userId, file);
    return successResponse(res, "Supporting document added successfully", application, 200);
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    return errorResponse(res, err.message || "Failed to add supporting document", storageStatusCode(err));
  }
};

export const removeSupportingDocController = async (req, res) => {
  try {
    const { key } = removeDocSchema.parse(req.body);
    const application = await removeSupportingDocument(req.user.userId, key);
    return successResponse(res, "Supporting document removed successfully", application, 200);
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    return errorResponse(res, err.message || "Failed to remove supporting document", storageStatusCode(err));
  }
};
