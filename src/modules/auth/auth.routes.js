import { Router } from "express";
import { register, login, me, refreshToken } from "./auth.controller.js";
import authMiddleware from "../../middleware/auth.middleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", authMiddleware, me);
router.post("/refresh-token", authMiddleware, refreshToken);

export default router;
