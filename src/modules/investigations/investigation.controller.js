import * as svc from "./investigation.service.js";
import { successResponse, errorResponse } from "../../utils/ApiResponse.js";

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
    const data = await svc.updateInvestigation(req.params.id, req.user.userId, req.body);
    return successResponse(res, "Investigation updated", data);
  } catch (err) {
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
    const { note, category, pinned } = req.body;
    if (!note?.trim()) return errorResponse(res, "note is required", 400);
    const data = await svc.createNote(req.params.id, req.user.userId, { note, category, pinned });
    return successResponse(res, "Note created", data, 201);
  } catch (err) {
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
    const { targetParticipant, message } = req.body;
    const data = await svc.requestInfo(req.params.id, req.user.userId, { targetParticipant, message });
    return successResponse(res, "Information requested", data, 201);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};
