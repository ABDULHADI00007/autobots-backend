import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import roleMiddleware from "../../middleware/role.middleware.js";
import {
  createReview,
  getListingReviews,
  getMyReviews,
  getAllReviews,
  updateReview,
  deleteReview,
} from "./review.controller.js";

const router = Router();

router.post("/", authMiddleware, roleMiddleware("buyer"), createReview);
router.get("/listing/:listingId", getListingReviews);
router.get("/my", authMiddleware, roleMiddleware("buyer"), getMyReviews);
router.get("/admin/all", authMiddleware, roleMiddleware("admin"), getAllReviews);
router.put("/:id", authMiddleware, roleMiddleware("buyer"), updateReview);
router.delete("/:id", authMiddleware, roleMiddleware("buyer"), deleteReview);

export default router;
