import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import roleMiddleware from "../../middleware/role.middleware.js";
import {
  getBuyerDashboard,
  getOverview,
  getRevenue,
  getOrderStats,
  getListingStats,
  getUserStats,
  getRefundStats,
  getReviewStats,
  getAnalytics,
} from "./dashboard.controller.js";

const router = Router();

router.get("/buyer", authMiddleware, roleMiddleware("buyer"), getBuyerDashboard);
router.use(authMiddleware, roleMiddleware("admin"));

router.get("/overview", getOverview);
router.get("/revenue", getRevenue);
router.get("/orders", getOrderStats);
router.get("/listings", getListingStats);
router.get("/users", getUserStats);
router.get("/refunds", getRefundStats);
router.get("/reviews", getReviewStats);
router.get("/analytics", getAnalytics);

export default router;
