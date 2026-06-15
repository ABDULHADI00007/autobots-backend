import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import roleMiddleware from "../../middleware/role.middleware.js";
import {
  createRefund,
  getMyRefunds,
  getAllRefunds,
  approveRefund,
  rejectRefund,
} from "./refund.controller.js";

const router = Router();

router.post("/", authMiddleware, roleMiddleware("buyer"), createRefund);
router.get("/my", authMiddleware, roleMiddleware("buyer"), getMyRefunds);
router.get("/admin/all", authMiddleware, roleMiddleware("admin"), getAllRefunds);
router.put("/:id/approve", authMiddleware, roleMiddleware("admin"), approveRefund);
router.put("/:id/reject", authMiddleware, roleMiddleware("admin"), rejectRefund);

export default router;
