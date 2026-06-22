import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import roleMiddleware from "../../middleware/role.middleware.js";
import {
  createCheckoutSession,
  getBuyerOrders,
  getSellerOrders,
  getAllOrders,
  acceptOrder,
  cancelOrder,
  deliverOrder,
  approveDelivery,
  requestRevision,
  adminReleaseFunds,
  adminRefundFunds,
} from "./order.controller.js";

const router = Router();

// Checkout
router.post("/checkout", authMiddleware, roleMiddleware("buyer"), createCheckoutSession);

// Queries
router.get("/my", authMiddleware, roleMiddleware("buyer"), getBuyerOrders);
router.get("/seller", authMiddleware, roleMiddleware("seller"), getSellerOrders);
router.get("/admin/all", authMiddleware, roleMiddleware("admin"), getAllOrders);

// Status updates
router.put("/:id/accept", authMiddleware, roleMiddleware("seller"), acceptOrder);
// Seller completes delivery
router.put("/:id/deliver", authMiddleware, roleMiddleware("seller"), deliverOrder);

// Buyer approves delivery
router.put("/:id/approve-delivery", authMiddleware, roleMiddleware("buyer"), approveDelivery);

// Buyer requests revision
router.put("/:id/request-revision", authMiddleware, roleMiddleware("buyer"), requestRevision);

// Cancel order
router.put("/:id/cancel", authMiddleware, roleMiddleware("buyer"), cancelOrder);

// Admin manual overrides
router.put("/:id/release-funds", authMiddleware, roleMiddleware("admin"), adminReleaseFunds);
router.put("/:id/refund-funds", authMiddleware, roleMiddleware("admin"), adminRefundFunds);

export default router;
