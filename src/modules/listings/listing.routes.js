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
  requestChangesListingController,
  hideListingController,
  unhideListingController,
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
router.put("/:id/request-changes", authMiddleware, roleMiddleware("admin"), requestChangesListingController);
router.put("/:id/hide", authMiddleware, roleMiddleware("admin"), hideListingController);
router.put("/:id/unhide", authMiddleware, roleMiddleware("admin"), unhideListingController);

router.get("/:slug", getListingBySlugController);

export default router;
