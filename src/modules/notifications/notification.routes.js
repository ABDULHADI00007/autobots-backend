import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import * as NotificationController from "./notification.controller.js";
import { paginationQuery, readParams, readByReferenceQuery } from "./notification.validation.js";

const router = Router();

router.use(authMiddleware);

router.get("/", validate(paginationQuery), NotificationController.listNotifications);
router.get("/unread-count", NotificationController.unreadCount);
router.put("/:id/read", validate(readParams), NotificationController.markRead);
router.put("/read-by-reference", validate(readByReferenceQuery), NotificationController.markReadByReference);
router.put("/read-all", NotificationController.markAll);
router.delete("/:id", validate(readParams), NotificationController.remove);

export default router;
