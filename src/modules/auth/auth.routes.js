import { Router } from "express";
import {
  register,
  login,
  me,
  refreshToken,
  verifyEmail,
  forgotPassword,
  resetPasswordController,
  changePasswordController,
} from "./auth.controller.js";
import authMiddleware from "../../middleware/auth.middleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/verify-email", verifyEmail);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPasswordController);
router.post("/change-password", authMiddleware, changePasswordController);
router.get("/me", authMiddleware, me);
router.post("/refresh-token", authMiddleware, refreshToken);

export default router;
