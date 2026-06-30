import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import ConversationParticipant from "../modules/conversations/conversationParticipant.model.js";
import { addConnection, removeConnection } from "./socketManager.js";
import { Server } from "socket.io";

let io;

const getAllowedOrigins = () => {
  const origins = [env.FRONTEND_URL, ...(env.ALLOWED_ORIGINS || [])].filter(Boolean);
  return origins;
};

const isConversationParticipant = async (conversationId, userId, role) => {
  if (!conversationId || !userId) return false;
  if (role === "admin") {
    return Boolean(await ConversationParticipant.findOne({ conversationId, userId }));
  }
  return Boolean(await ConversationParticipant.findOne({ conversationId, userId }));
};

export const initializeSocket = (httpServer) => {
  if (io) return io;

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        const allowedOrigins = getAllowedOrigins();
        const isAllowed =
          !origin ||
          allowedOrigins.includes(origin) ||
          origin.startsWith("http://localhost") ||
          origin.startsWith("http://127.0.0.1");

        if (isAllowed) {
          callback(null, true);
          return;
        }

        callback(new Error("Origin not allowed"));
      },
      credentials: true,
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication error"));
    }

    const normalizedToken =
      typeof token === "string" && token.startsWith("Bearer ") ? token.slice(7) : token;

    try {
      const decoded = jwt.verify(normalizedToken, env.JWT_SECRET);
      socket.data.userId = decoded.userId;
      socket.data.role = decoded.role;
      socket.data.name = decoded.name || "User";
      return next();
    } catch (error) {
      return next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    const { userId, role } = socket.data;

    if (!userId) {
      socket.disconnect(true);
      return;
    }

    addConnection(userId, socket.id);
    socket.join(`user:${userId}`);

    if (role === "admin") {
      socket.join("admin");
    }

    socket.on("conversation:join", async ({ conversationId }) => {
      if (!conversationId) {
        socket.emit("conversation:join:error", { conversationId, message: "Conversation ID is required" });
        return;
      }

      const authorized = await isConversationParticipant(conversationId, userId, role);
      if (!authorized) {
        socket.emit("conversation:join:error", { conversationId, message: "Access denied" });
        return;
      }

      socket.join(`conversation:${conversationId}`);
      socket.data.activeConversationId = conversationId;
    });

    socket.on("conversation:leave", ({ conversationId }) => {
      if (!conversationId) return;
      socket.leave(`conversation:${conversationId}`);
      if (socket.data.activeConversationId === conversationId) {
        delete socket.data.activeConversationId;
      }
    });

    socket.on("typing:start", async ({ conversationId }) => {
      if (!conversationId) return;
      const authorized = await isConversationParticipant(conversationId, userId, role);
      if (!authorized) return;

      socket.to(`conversation:${conversationId}`).emit("typing:start", {
        conversationId,
        userId,
        name: socket.data.name,
      });
    });

    socket.on("typing:stop", async ({ conversationId }) => {
      if (!conversationId) return;
      const authorized = await isConversationParticipant(conversationId, userId, role);
      if (!authorized) return;

      socket.to(`conversation:${conversationId}`).emit("typing:stop", {
        conversationId,
        userId,
      });
    });

    socket.on("disconnect", () => {
      removeConnection(userId, socket.id);
    });
  });

  return io;
};

export { io };
export { isOnline } from "./socketManager.js";
