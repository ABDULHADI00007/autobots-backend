import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import {
  getConversationsController,
  getConversationController,
  sendMessageController,
  markConversationReadController,
} from "./conversation.controller.js";

const router = Router();

router.get("/conversations", authMiddleware, getConversationsController);
router.get("/conversations/:conversationId", authMiddleware, getConversationController);
router.post("/conversations/:conversationId/messages", authMiddleware, sendMessageController);
router.put("/conversations/:conversationId/read", authMiddleware, markConversationReadController);

export default router;