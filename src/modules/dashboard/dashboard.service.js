import User from "../users/user.model.js";
import SellerApplication from "../sellerApplications/sellerApplication.model.js";
import Listing from "../listings/listing.model.js";
import Order from "../orders/order.model.js";
import Review from "../reviews/review.model.js";
import Refund from "../refunds/refund.model.js";

export const getOverview = async () => {
  const [totalUsers, totalSellers, totalListings, totalOrders, totalReviews, totalRefunds] = await Promise.all([
    User.countDocuments(),
    SellerApplication.countDocuments({ status: "approved" }),
    Listing.countDocuments(),
    Order.countDocuments(),
    Review.countDocuments(),
    Refund.countDocuments(),
  ]);

  return { totalUsers, totalSellers, totalListings, totalOrders, totalReviews, totalRefunds };
};

export const getRevenue = async () => {
  const [revenueResult, paidOrders, refundedOrders] = await Promise.all([
    Order.aggregate([
      { $match: { paymentStatus: "paid" } },
      { $group: { _id: null, totalRevenue: { $sum: "$amount" } } },
    ]),
    Order.countDocuments({ paymentStatus: "paid" }),
    Order.countDocuments({ paymentStatus: "refunded" }),
  ]);

  return {
    totalRevenue: revenueResult.length ? parseFloat(revenueResult[0].totalRevenue.toFixed(2)) : 0,
    paidOrders,
    refundedOrders,
  };
};

export const getOrderStats = async () => {
  const [pending, accepted, completed, cancelled] = await Promise.all([
    Order.countDocuments({ status: "pending" }),
    Order.countDocuments({ status: "accepted" }),
    Order.countDocuments({ status: "completed" }),
    Order.countDocuments({ status: "cancelled" }),
  ]);

  return { pending, accepted, completed, cancelled };
};

export const getListingStats = async () => {
  const [pending, approved, rejected] = await Promise.all([
    Listing.countDocuments({ status: "pending" }),
    Listing.countDocuments({ status: "approved" }),
    Listing.countDocuments({ status: "rejected" }),
  ]);

  return { pending, approved, rejected };
};

export const getUserStats = async () => {
  const [buyers, sellers, admins] = await Promise.all([
    User.countDocuments({ role: "buyer" }),
    User.countDocuments({ role: "seller" }),
    User.countDocuments({ role: "admin" }),
  ]);

  return { buyers, sellers, admins };
};

export const getRefundStats = async () => {
  const [pending, approved, rejected] = await Promise.all([
    Refund.countDocuments({ status: "pending" }),
    Refund.countDocuments({ status: "approved" }),
    Refund.countDocuments({ status: "rejected" }),
  ]);

  return { pending, approved, rejected };
};

export const getReviewStats = async () => {
  const [totalReviews, ratingResult] = await Promise.all([
    Review.countDocuments(),
    Review.aggregate([
      { $group: { _id: null, averageMarketplaceRating: { $avg: "$rating" } } },
    ]),
  ]);

  return {
    totalReviews,
    averageMarketplaceRating: ratingResult.length ? parseFloat(ratingResult[0].averageMarketplaceRating.toFixed(1)) : 0,
  };
};
