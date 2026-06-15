import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import roleMiddleware from "../../middleware/role.middleware.js";
import {
  createListingController,
  getPublicListingsController,
  getListingBySlugController,
  getMyListingsController,
  updateListingController,
  deleteListingController,
  getAllListingsForAdminController,
  approveListingController,
  rejectListingController,
} from "./listing.controller.js";

const router = Router();

router.post("/", authMiddleware, roleMiddleware("seller"), createListingController);
router.get("/", getPublicListingsController);

router.get("/my", authMiddleware, roleMiddleware("seller"), getMyListingsController);
router.get("/admin/all", authMiddleware, roleMiddleware("admin"), getAllListingsForAdminController);

router.put("/:id", authMiddleware, roleMiddleware("seller"), updateListingController);
router.delete("/:id", authMiddleware, roleMiddleware("seller"), deleteListingController);

router.put("/:id/approve", authMiddleware, roleMiddleware("admin"), approveListingController);
router.put("/:id/reject", authMiddleware, roleMiddleware("admin"), rejectListingController);

router.get("/:slug", getListingBySlugController);

export default router;
