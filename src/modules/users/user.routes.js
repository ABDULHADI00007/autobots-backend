import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import roleMiddleware from "../../middleware/role.middleware.js";
import {
  getProfileController,
  updateProfileController,
  updateRoleController,
  uploadAvatarController,
  removeAvatarController,
  uploadLogoController,
  removeLogoController,
  uploadBannerController,
  removeBannerController,
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

// ── Existing profile routes (unchanged) ───────────────────────────────
router.get("/profile", authMiddleware, getProfileController);
router.put("/profile", authMiddleware, updateProfileController);
router.put("/role", authMiddleware, updateRoleController);

// ── Media upload routes (new — S3 only) ────────────────────────────
// Avatar (all roles)
router.put("/profile/avatar",    authMiddleware, uploadAvatarController);
router.delete("/profile/avatar", authMiddleware, removeAvatarController);

// Seller logo (sellers only)
router.put("/profile/logo",    authMiddleware, roleMiddleware("seller"), uploadLogoController);
router.delete("/profile/logo", authMiddleware, roleMiddleware("seller"), removeLogoController);

// Seller banner (sellers only)
router.put("/profile/banner",    authMiddleware, roleMiddleware("seller"), uploadBannerController);
router.delete("/profile/banner", authMiddleware, roleMiddleware("seller"), removeBannerController);

// ── Admin routes (unchanged) ─────────────────────────────────────
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
