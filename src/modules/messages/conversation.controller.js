import { successResponse, errorResponse } from "../../utils/ApiResponse.js";
import { conversationIdSchema, sendMessageSchema } from "./conversation.validation.js";
import * as conversationService from "./conversation.service.js";

export const getConversationsController = async (req, res) => {
  try {
    const conversations = await conversationService.listConversations(req.user.userId, req.user.role);
    return successResponse(res, "Conversations fetched successfully", conversations, 200);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const getConversationController = async (req, res) => {
  try {
    const params = conversationIdSchema.parse(req.params);
    const conversation = await conversationService.getConversation(params.conversationId, req.user.userId, req.user.role);
    return successResponse(res, "Conversation fetched successfully", conversation, 200);
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    const statusCode = err.message === "Access denied" ? 403 : 400;
    return errorResponse(res, err.message, statusCode);
  }
};

export const sendMessageController = async (req, res) => {
  try {
    const params = conversationIdSchema.parse(req.params);
    const body = sendMessageSchema.parse(req.body);
    const message = await conversationService.sendMessage(
      params.conversationId,
      req.user.userId,
      req.user.role,
      body.body,
      body.type
    );
    return successResponse(res, "Message sent successfully", message, 201);
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    const statusCode = err.message === "Access denied" ? 403 : 400;
    return errorResponse(res, err.message, statusCode);
  }
};

export const markConversationReadController = async (req, res) => {
  try {
    const params = conversationIdSchema.parse(req.params);
    const participant = await conversationService.markConversationRead(params.conversationId, req.user.userId, req.user.role);
    return successResponse(res, "Conversation marked as read", participant, 200);
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    const statusCode = err.message === "Access denied" ? 403 : 400;
    return errorResponse(res, err.message, statusCode);
  }
};
