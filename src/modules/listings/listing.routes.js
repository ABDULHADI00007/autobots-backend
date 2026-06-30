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
  uploadThumbnailController,
  removeThumbnailController,
  addGalleryImageController,
  removeGalleryImageController,
  reorderGalleryController,
  uploadListingMediaController,
  deleteListingMediaController,
  createDraftListingController,
  submitDraftListingController,
} from "./listing.controller.js";

const router = Router();

// ── Draft workflow (Phase 11G) — must be before /:id routes ──────────────
router.post("/draft",     authMiddleware, roleMiddleware("seller"), createDraftListingController);
router.put("/:id/submit", authMiddleware, roleMiddleware("seller"), submitDraftListingController);

// ── Existing routes (unchanged) ──────────────────────────────────────────
router.post("/", authMiddleware, roleMiddleware("seller"), createListingController);
router.get("/", getPublicListingsController);

router.get("/my", authMiddleware, roleMiddleware("seller"), getMyListingsController);
router.get("/admin/all", authMiddleware, roleMiddleware("admin"), getAllListingsForAdminController);

router.put("/:id", authMiddleware, roleMiddleware("seller"), updateListingController);
router.delete("/:id", authMiddleware, roleMiddleware("seller"), deleteListingController);

router.put("/:id/approve",         authMiddleware, roleMiddleware("admin"), approveListingController);
router.put("/:id/reject",          authMiddleware, roleMiddleware("admin"), rejectListingController);
router.put("/:id/request-changes", authMiddleware, roleMiddleware("admin"), requestChangesListingController);
router.put("/:id/hide",            authMiddleware, roleMiddleware("admin"), hideListingController);
router.put("/:id/unhide",          authMiddleware, roleMiddleware("admin"), unhideListingController);

router.get("/:slug", getListingBySlugController);

// ── Media upload routes (S3 only) ─────────────────────────────────────────
// Thumbnail
router.put("/:id/thumbnail",    authMiddleware, roleMiddleware("seller"), uploadThumbnailController);
router.delete("/:id/thumbnail", authMiddleware, roleMiddleware("seller"), removeThumbnailController);

// Gallery
router.post("/:id/gallery",          authMiddleware, roleMiddleware("seller"), addGalleryImageController);
router.delete("/:id/gallery/image",  authMiddleware, roleMiddleware("seller"), removeGalleryImageController);
router.put("/:id/gallery/reorder",   authMiddleware, roleMiddleware("seller"), reorderGalleryController);

// Media — demoVideo | documentation | setupGuide
router.put("/:id/media/:mediaType",    authMiddleware, roleMiddleware("seller"), uploadListingMediaController);
router.delete("/:id/media/:mediaType", authMiddleware, roleMiddleware("seller"), deleteListingMediaController);

export default router;
