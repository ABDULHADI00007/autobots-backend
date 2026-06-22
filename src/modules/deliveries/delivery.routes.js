import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import roleMiddleware from "../../middleware/role.middleware.js";
import {
  getOrderDeliveriesController,
  createOrderDeliveryController,
  getDeliveryController,
} from "./delivery.controller.js";

const router = Router();

// Seller creates delivery artifacts
router.post(
  "/orders/:orderId/deliveries",
  authMiddleware,
  roleMiddleware("seller"),
  createOrderDeliveryController
);

// Buyer/admin can view
router.get(
  "/orders/:orderId/deliveries",
  authMiddleware,
  roleMiddleware("buyer", "seller", "admin"),
  getOrderDeliveriesController
);

router.get(
  "/deliveries/:deliveryId",
  authMiddleware,
  roleMiddleware("buyer", "seller", "admin"),
  getDeliveryController
);

export default router;


