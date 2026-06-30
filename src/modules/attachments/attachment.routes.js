import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import {
  createAttachmentController,
  deleteAttachmentController,
  getAttachmentController,
  listAttachmentsController,
  downloadAttachmentController,
} from "./attachment.controller.js";

const router = Router();

router.post("/", authMiddleware, createAttachmentController);
router.get("/", authMiddleware, listAttachmentsController);
router.get("/:attachmentId", authMiddleware, getAttachmentController);
router.delete("/:attachmentId", authMiddleware, deleteAttachmentController);

// ── Secure download endpoint ──────────────────────────────────────────────
// Returns a short-lived presigned URL for private file attachments.
// Authorization is enforced before any URL is generated.
router.get("/:attachmentId/download", authMiddleware, downloadAttachmentController);

export default router;
