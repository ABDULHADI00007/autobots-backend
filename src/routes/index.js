import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import userRoutes from "../modules/users/user.routes.js";
import sellerApplicationRoutes from "../modules/sellerApplications/sellerApplication.routes.js";
import categoryRoutes from "../modules/categories/category.routes.js";
import listingRoutes from "../modules/listings/listing.routes.js";
import orderRoutes from "../modules/orders/order.routes.js";
import reviewRoutes from "../modules/reviews/review.routes.js";
import refundRoutes from "../modules/refunds/refund.routes.js";
import dashboardRoutes from "../modules/dashboard/dashboard.routes.js";
import disputeRoutes from "../modules/disputes/dispute.routes.js";
import attachmentRoutes from "../modules/attachments/attachment.routes.js";
import messageRoutes from "../modules/messages/conversation.routes.js";
import deliveryRoutes from "../modules/deliveries/delivery.routes.js";
import { disputeEvidenceRouter, evidenceRouter } from "../modules/evidence/evidence.routes.js";
import investigationRoutes from "../modules/investigations/investigation.routes.js";
import { orderTimelineRouter, disputeTimelineRouter } from "../modules/timeline/timeline.routes.js";
import settingsRoutes from "../modules/settings/settings.routes.js";

const router = Router();


router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/seller-applications", sellerApplicationRoutes);
router.use("/categories", categoryRoutes);
router.use("/listings", listingRoutes);
router.use("/orders", orderRoutes);
router.use("/orders/:orderId/timeline", orderTimelineRouter);
router.use("/reviews", reviewRoutes);
router.use("/refunds", refundRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/disputes", disputeRoutes);
router.use("/disputes/:disputeId/evidence", disputeEvidenceRouter);
router.use("/disputes/:disputeId/timeline", disputeTimelineRouter);
router.use("/disputes/:id", investigationRoutes);
router.use("/evidence", evidenceRouter);
router.use("/attachments", attachmentRoutes);
router.use("/messages", messageRoutes);
router.use("/settings", settingsRoutes);
router.use("/", deliveryRoutes);

export default router;