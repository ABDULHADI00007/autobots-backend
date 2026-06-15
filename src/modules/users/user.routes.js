import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import {
  getProfileController,
  updateProfileController,
  updateRoleController,
} from "./user.controller.js";

const router = Router();

router.get("/profile", authMiddleware, getProfileController);
router.put("/profile", authMiddleware, updateProfileController);
router.put("/role", authMiddleware, updateRoleController);

export default router;
