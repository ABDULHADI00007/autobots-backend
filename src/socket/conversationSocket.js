import { io } from "./index.js";
import * as conversationService from "../modules/messages/conversation.service.js";

export const emitMessageSent = async (conversationId, message, recipientUserIds = []) => {
  const socketServer = io;
  if (!socketServer) return;

  const payload = {
    conversationId,
    message,
  };

  socketServer.to(`conversation:${conversationId}`).emit("message:sent", payload);

  if (recipientUserIds.length) {
    recipientUserIds.forEach((userId) => {
      socketServer.to(`user:${userId}`).emit("message:sent", payload);
    });
  }
};

export const emitMessageRead = async (conversationId, participant, userId) => {
  const socketServer = io;
  if (!socketServer) return;

  socketServer.to(`conversation:${conversationId}`).emit("message:read", {
    conversationId,
    userId,
    participant,
  });
};
