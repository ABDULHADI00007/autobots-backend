import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import roleMiddleware from "../../middleware/role.middleware.js";
import {
  createCheckoutSession,
  getBuyerOrders,
  getSellerOrders,
  getAllOrders,
  acceptOrder,
  completeOrder,
  cancelOrder,
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
router.put("/:id/complete", authMiddleware, roleMiddleware("seller"), completeOrder);
router.put("/:id/cancel", authMiddleware, cancelOrder);

export default router;
