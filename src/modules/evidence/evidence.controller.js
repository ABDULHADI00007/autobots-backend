import { successResponse, errorResponse } from "../../utils/ApiResponse.js";
import {
  createEvidenceSchema,
  requestEvidenceSchema,
  evidenceIdParamSchema,
  disputeIdParamSchema,
} from "./evidence.validation.js";
import * as evidenceService from "./evidence.service.js";

// POST /disputes/:disputeId/evidence
export const createEvidenceController = async (req, res) => {
  try {
    const { disputeId } = disputeIdParamSchema.parse(req.params);
    const body          = createEvidenceSchema.parse(req.body || {});
    const evidence      = await evidenceService.createEvidence(
      disputeId,
      body,
      req.user.userId,
      req.user.role
    );
    return successResponse(res, "Evidence submitted", evidence, 201);
  } catch (err) {
    if (err.name === "ZodError")
      return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    const status = err.message === "Access denied" ? 403 : 400;
    return errorResponse(res, err.message, status);
  }
};

// GET /disputes/:disputeId/evidence
export const listEvidenceController = async (req, res) => {
  try {
    const { disputeId } = disputeIdParamSchema.parse(req.params);
    const evidence      = await evidenceService.listEvidence(
      disputeId,
      req.user.userId,
      req.user.role
    );
    return successResponse(res, "Evidence fetched", evidence, 200);
  } catch (err) {
    if (err.name === "ZodError")
      return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    const status = err.message === "Access denied" ? 403 : 400;
    return errorResponse(res, err.message, status);
  }
};

// GET /evidence/:id
export const getEvidenceController = async (req, res) => {
  try {
    const { id }   = evidenceIdParamSchema.parse(req.params);
    const evidence = await evidenceService.getEvidence(id, req.user.userId, req.user.role);
    return successResponse(res, "Evidence fetched", evidence, 200);
  } catch (err) {
    if (err.name === "ZodError")
      return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    const status = err.message === "Access denied" ? 403 : 404;
    return errorResponse(res, err.message, status);
  }
};

// POST /evidence/:id/verify  — admin only
export const verifyEvidenceController = async (req, res) => {
  try {
    const { id }   = evidenceIdParamSchema.parse(req.params);
    const evidence = await evidenceService.verifyEvidence(id, req.user.userId);
    return successResponse(res, "Evidence verified", evidence, 200);
  } catch (err) {
    if (err.name === "ZodError")
      return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    return errorResponse(res, err.message, 400);
  }
};

// POST /disputes/:disputeId/evidence/request  — admin only
export const requestEvidenceController = async (req, res) => {
  try {
    const { disputeId } = disputeIdParamSchema.parse(req.params);
    const body          = requestEvidenceSchema.parse(req.body || {});
    const result        = await evidenceService.requestEvidence(
      disputeId,
      body,
      req.user.userId
    );
    return successResponse(res, "Evidence requested", result, 200);
  } catch (err) {
    if (err.name === "ZodError")
      return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    const status = err.message === "Access denied" ? 403 : 400;
    return errorResponse(res, err.message, status);
  }
};

// DELETE /evidence/:id
export const deleteEvidenceController = async (req, res) => {
  try {
    const { id } = evidenceIdParamSchema.parse(req.params);
    const result = await evidenceService.deleteEvidence(id, req.user.userId, req.user.role);
    return successResponse(res, "Evidence deleted", result, 200);
  } catch (err) {
    if (err.name === "ZodError")
      return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    const status = err.message === "Access denied" ? 403 : 400;
    return errorResponse(res, err.message, status);
  }
};
