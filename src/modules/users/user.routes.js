import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import roleMiddleware from "../../middleware/role.middleware.js";
import {
  getProfileController,
  updateProfileController,
  updateRoleController,
  getAdminUsersController,
  getAdminSellersController,
  getAdminSellerByIdController,
  getAdminBuyersController,
  getAdminBuyerByIdController,
  suspendBuyerController,
  unsuspendBuyerController,
  createBuyerAdminNoteController,
  verifySellerController,
  unverifySellerController,
} from "./user.controller.js";

const router = Router();

router.get("/profile", authMiddleware, getProfileController);
router.put("/profile", authMiddleware, updateProfileController);
router.put("/role", authMiddleware, updateRoleController);

router.get("/admin/admins", authMiddleware, roleMiddleware("admin"), getAdminUsersController);
router.get("/admin/sellers", authMiddleware, roleMiddleware("admin"), getAdminSellersController);
router.get("/admin/sellers/:userId", authMiddleware, roleMiddleware("admin"), getAdminSellerByIdController);
router.post("/admin/sellers/:userId/verify", authMiddleware, roleMiddleware("admin"), verifySellerController);
router.post("/admin/sellers/:userId/unverify", authMiddleware, roleMiddleware("admin"), unverifySellerController);
router.get("/admin/buyers", authMiddleware, roleMiddleware("admin"), getAdminBuyersController);
router.get("/admin/buyers/:userId", authMiddleware, roleMiddleware("admin"), getAdminBuyerByIdController);
router.post("/admin/buyers/:userId/suspend", authMiddleware, roleMiddleware("admin"), suspendBuyerController);
router.post("/admin/buyers/:userId/unsuspend", authMiddleware, roleMiddleware("admin"), unsuspendBuyerController);
router.post("/admin/buyers/:userId/notes", authMiddleware, roleMiddleware("admin"), createBuyerAdminNoteController);

export default router;
