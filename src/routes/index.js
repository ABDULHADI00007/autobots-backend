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

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/seller-applications", sellerApplicationRoutes);
router.use("/categories", categoryRoutes);
router.use("/listings", listingRoutes);
router.use("/orders", orderRoutes);
router.use("/reviews", reviewRoutes);
router.use("/refunds", refundRoutes);
router.use("/dashboard", dashboardRoutes);

export default router;
