import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import roleMiddleware from "../../middleware/role.middleware.js";
import { getSettingsController, updateSettingsController } from "./settings.controller.js";

const router = Router();

router.use(authMiddleware, roleMiddleware("admin"));
router.get("/", getSettingsController);
router.put("/", updateSettingsController);

export default router;
