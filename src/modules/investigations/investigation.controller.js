import * as svc from "./investigation.service.js";
import { successResponse, errorResponse } from "../../utils/ApiResponse.js";
import { createNoteSchema, requestInfoSchema, updateInvestigationSchema } from "./investigation.validation.js";

export const getInvestigationController = async (req, res) => {
  try {
    const data = await svc.getInvestigation(req.params.id);
    return successResponse(res, "Investigation fetched", data);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const updateInvestigationController = async (req, res) => {
  try {
    const data = updateInvestigationSchema.parse(req.body);
    const result = await svc.updateInvestigation(req.params.id, req.user.userId, data);
    return successResponse(res, "Investigation updated", result);
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    return errorResponse(res, err.message, 400);
  }
};

export const getNotesController = async (req, res) => {
  try {
    const data = await svc.getNotes(req.params.id);
    return successResponse(res, "Notes fetched", data);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const createNoteController = async (req, res) => {
  try {
    const data = createNoteSchema.parse(req.body);
    const result = await svc.createNote(req.params.id, req.user.userId, data);
    return successResponse(res, "Note created", result, 201);
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    return errorResponse(res, err.message, 400);
  }
};

export const updateNoteController = async (req, res) => {
  try {
    const data = await svc.updateNote(req.params.id, req.params.noteId, req.user.userId, req.body);
    return successResponse(res, "Note updated", data);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const deleteNoteController = async (req, res) => {
  try {
    await svc.deleteNote(req.params.id, req.params.noteId);
    return successResponse(res, "Note deleted", null);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const requestInfoController = async (req, res) => {
  try {
    const data = requestInfoSchema.parse(req.body);
    const result = await svc.requestInfo(req.params.id, req.user.userId, data);
    return successResponse(res, "Information requested", result, 201);
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    return errorResponse(res, err.message, 400);
  }
};
