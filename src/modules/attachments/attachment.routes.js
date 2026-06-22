import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import {
  createAttachmentController,
  deleteAttachmentController,
  getAttachmentController,
  listAttachmentsController,
} from "./attachment.controller.js";

const router = Router();

router.post("/", authMiddleware, createAttachmentController);
router.get("/", authMiddleware, listAttachmentsController);
router.get("/:attachmentId", authMiddleware, getAttachmentController);
router.delete("/:attachmentId", authMiddleware, deleteAttachmentController);

export default router;
