import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import roleMiddleware from "../../middleware/role.middleware.js";
import {
  createApplicationController,
  getMyApplicationController,
  getAllApplicationsController,
  approveApplicationController,
  rejectApplicationController,
} from "./sellerApplication.controller.js";

const router = Router();

router.post("/", authMiddleware, createApplicationController);
router.get("/me", authMiddleware, getMyApplicationController);
router.get("/", authMiddleware, roleMiddleware("admin"), getAllApplicationsController);
router.put("/:id/approve", authMiddleware, roleMiddleware("admin"), approveApplicationController);
router.put("/:id/reject", authMiddleware, roleMiddleware("admin"), rejectApplicationController);

export default router;
