import { successResponse, errorResponse } from "../../utils/ApiResponse.js";
import { attachmentIdSchema, createAttachmentSchema, listAttachmentsSchema } from "./attachment.validation.js";
import * as attachmentService from "./attachment.service.js";

export const createAttachmentController = async (req, res) => {
  try {
    const body = createAttachmentSchema.parse(req.body || {});
    const payload = await attachmentService.createAttachment({
      ...body,
      uploaderId: req.user.userId,
      role: req.user.role,
    });
    return successResponse(res, "Attachment created", payload, 201);
  } catch (err) {
    if (err.name === "ZodError") {
      return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    }
    const statusCode = err.message === "Access denied" ? 403 : 400;
    return errorResponse(res, err.message, statusCode);
  }
};

export const getAttachmentController = async (req, res) => {
  try {
    const params = attachmentIdSchema.parse(req.params);
    const payload = await attachmentService.getAttachment(params.attachmentId, req.user.userId, req.user.role);
    return successResponse(res, "Attachment fetched", payload, 200);
  } catch (err) {
    if (err.name === "ZodError") {
      return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    }
    const statusCode = err.message === "Access denied" ? 403 : 400;
    return errorResponse(res, err.message, statusCode);
  }
};

export const listAttachmentsController = async (req, res) => {
  try {
    const query = listAttachmentsSchema.parse(req.query || {});
    const payload = await attachmentService.listAttachments({
      userId: req.user.userId,
      role: req.user.role,
      parentType: query.parentType,
      parentId: query.parentId,
      uploaderId: query.uploaderId,
    });
    return successResponse(res, "Attachments fetched", payload, 200);
  } catch (err) {
    if (err.name === "ZodError") {
      return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    }
    const statusCode = err.message === "Access denied" ? 403 : 400;
    return errorResponse(res, err.message, statusCode);
  }
};

export const deleteAttachmentController = async (req, res) => {
  try {
    const params = attachmentIdSchema.parse(req.params);
    const payload = await attachmentService.deleteAttachment(params.attachmentId, req.user.userId, req.user.role);
    return successResponse(res, "Attachment deleted", payload, 200);
  } catch (err) {
    if (err.name === "ZodError") {
      return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    }
    const statusCode = err.message === "Access denied" ? 403 : 400;
    return errorResponse(res, err.message, statusCode);
  }
};
