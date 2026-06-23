import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import roleMiddleware from "../../middleware/role.middleware.js";
import {
  createDisputeController,
  getMyDisputesController,
  getAllDisputesController,
  resolveDisputeController,
  resolveDisputeFinalController,
} from "./dispute.controller.js";

const router = Router();

router.post("/", authMiddleware, roleMiddleware("buyer", "seller"), createDisputeController);
router.get("/my", authMiddleware, getMyDisputesController);
router.get("/admin/all", authMiddleware, roleMiddleware("admin"), getAllDisputesController);
router.put("/:id/resolve", authMiddleware, roleMiddleware("admin"), resolveDisputeController);
router.post("/:id/resolve", authMiddleware, roleMiddleware("admin"), resolveDisputeFinalController);

export default router;
