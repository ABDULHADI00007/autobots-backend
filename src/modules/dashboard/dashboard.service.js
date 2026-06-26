import User from "../users/user.model.js";
import SellerApplication from "../sellerApplications/sellerApplication.model.js";
import Listing from "../listings/listing.model.js";
import Order from "../orders/order.model.js";
import Review from "../reviews/review.model.js";
import Refund from "../refunds/refund.model.js";
import Dispute from "../disputes/dispute.model.js";

const roundValue = (value) => Number(value || 0).toFixed(2);

const getDateRange = ({ range = "30d", startDate, endDate } = {}) => {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);

  switch (range) {
    case "7d":
      start.setDate(now.getDate() - 7);
      break;
    case "90d":
      start.setDate(now.getDate() - 90);
      break;
    case "30d":
    default:
      start.setDate(now.getDate() - 30);
      break;
  }

  if (startDate) {
    const parsedStart = new Date(startDate);
    if (!Number.isNaN(parsedStart.getTime())) {
      start = parsedStart;
    }
  }

  if (endDate) {
    const parsedEnd = new Date(endDate);
    if (!Number.isNaN(parsedEnd.getTime())) {
      end = parsedEnd;
    }
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (end < start) {
    const temp = end;
    end = start;
    start = temp;
  }

  return { from: start, to: end };
};

const formatMonthLabel = (year, month) => {
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
};

export const getOverview = async () => {
  const [totalUsers, totalSellers, totalListings, totalOrders, totalReviews, totalRefunds] = await Promise.all([
    User.countDocuments(),
    SellerApplication.countDocuments({ status: "approved" }),
    Listing.countDocuments(),
    Order.countDocuments(),
    Review.countDocuments(),
    Refund.countDocuments(),
  ]);

  // Escrow-related stats
  const [totalHeldFundsResult, totalReleasedFundsResult, totalRefundedFundsResult, openDisputes, resolvedDisputes, disputedOrders] = await Promise.all([
    Order.aggregate([{ $match: { paymentStatus: "held" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    Order.aggregate([{ $match: { paymentStatus: "released" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    Order.aggregate([{ $match: { paymentStatus: "refunded" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    Dispute.countDocuments({ status: "open" }),
    Dispute.countDocuments({ status: "resolved" }),
    Order.countDocuments({ status: "disputed" }),
  ]);

  const totalHeldFunds = totalHeldFundsResult.length ? parseFloat(totalHeldFundsResult[0].total.toFixed(2)) : 0;
  const totalReleasedFunds = totalReleasedFundsResult.length ? parseFloat(totalReleasedFundsResult[0].total.toFixed(2)) : 0;
  const totalRefundedFunds = totalRefundedFundsResult.length ? parseFloat(totalRefundedFundsResult[0].total.toFixed(2)) : 0;

  return {
    totalUsers,
    totalSellers,
    totalListings,
    totalOrders,
    totalReviews,
    totalRefunds,
    totalHeldFunds,
    totalReleasedFunds,
    totalRefundedFunds,
    openDisputes,
    resolvedDisputes,
    disputedOrders,
  };
};

export const getRevenue = async () => {
  const [revenueResult, releasedOrders, refundedOrders] = await Promise.all([
    Order.aggregate([
      { $match: { paymentStatus: "released" } },
      { $group: { _id: null, totalRevenue: { $sum: "$amount" } } },
    ]),
    Order.countDocuments({ paymentStatus: "released" }),
    Order.countDocuments({ paymentStatus: "refunded" }),
  ]);

  return {
    totalRevenue: revenueResult.length ? parseFloat(revenueResult[0].totalRevenue.toFixed(2)) : 0,
    releasedOrders,
    refundedOrders,
  };
};

export const getOrderStats = async () => {
  const [pending, accepted, completed, cancelled, disputed] = await Promise.all([
    Order.countDocuments({ status: "pending" }),
    Order.countDocuments({ status: "accepted" }),
    Order.countDocuments({ status: "completed" }),
    Order.countDocuments({ status: "cancelled" }),
    Order.countDocuments({ status: "disputed" }),
  ]);

  return { pending, accepted, completed, cancelled, disputed };
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

export const getAnalytics = async ({ range = "30d", startDate, endDate } = {}) => {
  const dateRange = getDateRange({ range, startDate, endDate });
  const dateMatch = {
    createdAt: {
      $gte: dateRange.from,
      $lte: dateRange.to,
    },
  };

  const [revenueResult, grossSalesResult, totalOrders, totalBuyers, totalSellers, activeListings, pendingSellerApplications, openDisputes, refundCount, reviewStats, revenueByMonthData, ordersByMonthData, categoryBreakdownData, topListingsData, topSellersData, recentOrdersData, recentBuyersData, recentSellersData, recentRefundsData, recentDisputesData] = await Promise.all([
    Order.aggregate([
      { $match: { ...dateMatch, paymentStatus: "released" } },
      { $group: { _id: null, totalRevenue: { $sum: "$amount" } } },
    ]),
    Order.aggregate([
      { $match: dateMatch },
      { $group: { _id: null, grossSales: { $sum: "$amount" } } },
    ]),
    Order.countDocuments(dateMatch),
    User.countDocuments({ role: "buyer", ...dateMatch }),
    User.countDocuments({ role: "seller", ...dateMatch }),
    Listing.countDocuments({ status: "approved", ...dateMatch }),
    SellerApplication.countDocuments({ status: "pending", ...dateMatch }),
    Dispute.countDocuments({ status: { $in: ["open", "under_review"] }, ...dateMatch }),
    Refund.countDocuments(dateMatch),
    Review.aggregate([
      { $match: dateMatch },
      { $group: { _id: null, averageRating: { $avg: "$rating" } } },
    ]),
    Order.aggregate([
      { $match: { ...dateMatch, paymentStatus: "released" } },
      { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, value: { $sum: "$amount" } } },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),
    Order.aggregate([
      { $match: dateMatch },
      { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, value: { $sum: 1 } } },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),
    Order.aggregate([
      { $match: dateMatch },
      { $lookup: { from: "listings", localField: "listingId", foreignField: "_id", as: "listing" } },
      { $unwind: { path: "$listing", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: "categories", localField: "listing.categoryId", foreignField: "_id", as: "category" } },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      { $group: { _id: "$category._id", name: { $first: "$category.name" }, orders: { $sum: 1 }, revenue: { $sum: "$amount" } } },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]),
    Order.aggregate([
      { $match: dateMatch },
      { $lookup: { from: "listings", localField: "listingId", foreignField: "_id", as: "listing" } },
      { $unwind: { path: "$listing", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: "users", localField: "listing.sellerId", foreignField: "_id", as: "seller" } },
      { $unwind: { path: "$seller", preserveNullAndEmptyArrays: true } },
      { $group: { _id: "$listing._id", title: { $first: "$listing.title" }, seller: { $first: "$seller.name" }, orders: { $sum: 1 }, revenue: { $sum: "$amount" } } },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]),
    Order.aggregate([
      { $match: dateMatch },
      { $lookup: { from: "users", localField: "sellerId", foreignField: "_id", as: "seller" } },
      { $unwind: { path: "$seller", preserveNullAndEmptyArrays: true } },
      { $group: { _id: "$seller._id", name: { $first: "$seller.name" }, orders: { $sum: 1 }, revenue: { $sum: "$amount" } } },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]),
    Order.find(dateMatch).sort({ createdAt: -1 }).limit(5).populate("listingId", "title").populate("buyerId", "name").populate("sellerId", "name").lean(),
    User.find({ role: "buyer", ...dateMatch }).sort({ createdAt: -1 }).limit(5).select("name email createdAt").lean(),
    User.find({ role: "seller", ...dateMatch }).sort({ createdAt: -1 }).limit(5).select("name email createdAt").lean(),
    Refund.find(dateMatch).sort({ createdAt: -1 }).limit(5).populate("orderId", "amount").populate("buyerId", "name").populate("sellerId", "name").lean(),
    Dispute.find({ ...dateMatch, status: { $in: ["open", "under_review", "resolved"] } }).sort({ createdAt: -1 }).limit(5).populate("orderId", "amount").populate("openerId", "name").lean(),
  ]);

  const totalRevenue = revenueResult[0]?.totalRevenue || 0;
  const grossSales = grossSalesResult[0]?.grossSales || 0;
  const averageRating = reviewStats[0]?.averageRating || 0;
  const categoryRevenueTotal = categoryBreakdownData.reduce((sum, item) => sum + (item.revenue || 0), 0);

  return {
    range: {
      value: range,
      from: dateRange.from.toISOString(),
      to: dateRange.to.toISOString(),
    },
    summary: {
      totalRevenue: Number(parseFloat(roundValue(totalRevenue))),
      grossSales: Number(parseFloat(roundValue(grossSales))),
      totalOrders,
      totalBuyers,
      totalSellers,
      activeListings,
      pendingSellerApplications,
      openDisputes,
      refundCount,
      averageRating: Number(parseFloat(averageRating.toFixed(1))),
    },
    revenueByMonth: revenueByMonthData.map((item) => ({
      month: formatMonthLabel(item._id.year, item._id.month),
      value: Number(parseFloat(roundValue(item.value || 0))),
    })),
    ordersByMonth: ordersByMonthData.map((item) => ({
      month: formatMonthLabel(item._id.year, item._id.month),
      value: item.value || 0,
    })),
    categoryBreakdown: categoryBreakdownData.map((item) => ({
      name: item.name || "Uncategorized",
      orders: item.orders || 0,
      revenue: Number(parseFloat(roundValue(item.revenue || 0))),
      pct: categoryRevenueTotal > 0 ? Math.round(((item.revenue || 0) / categoryRevenueTotal) * 100) : 0,
    })),
    topListings: topListingsData.map((item) => ({
      title: item.title || "Untitled listing",
      seller: item.seller || "Unknown seller",
      orders: item.orders || 0,
      revenue: Number(parseFloat(roundValue(item.revenue || 0))),
    })),
    conversionMetrics: {
      browseToView: totalOrders > 0 ? Math.min(100, Math.round((Math.min(totalOrders, activeListings) / Math.max(activeListings || 1, 1)) * 100)) : 0,
      viewToPurchase: totalOrders > 0 && activeListings > 0 ? Math.min(100, Math.round((totalOrders / (activeListings + totalOrders)) * 100)) : 0,
      refundRate: totalOrders > 0 ? Number(parseFloat(((refundCount / totalOrders) * 100).toFixed(1))) : 0,
      avgOrderValue: totalOrders > 0 ? Number(parseFloat(roundValue(grossSales / totalOrders))) : 0,
    },
    recentOrders: recentOrdersData.map((order) => ({
      _id: order._id,
      amount: Number(parseFloat(roundValue(order.amount || 0))),
      status: order.status,
      createdAt: order.createdAt,
      listingTitle: order.listingId?.title || "Untitled listing",
      buyerName: order.buyerId?.name || "Unknown buyer",
      sellerName: order.sellerId?.name || "Unknown seller",
    })),
    recentBuyers: recentBuyersData.map((buyer) => ({
      _id: buyer._id,
      name: buyer.name,
      email: buyer.email,
      createdAt: buyer.createdAt,
    })),
    recentSellers: recentSellersData.map((seller) => ({
      _id: seller._id,
      name: seller.name,
      email: seller.email,
      createdAt: seller.createdAt,
    })),
    recentRefunds: recentRefundsData.map((refund) => ({
      _id: refund._id,
      amount: Number(parseFloat(roundValue(refund.amount || 0))),
      reason: refund.reason || "No reason provided",
      status: refund.status,
      createdAt: refund.createdAt,
      buyerName: refund.buyerId?.name || "Unknown buyer",
      sellerName: refund.sellerId?.name || "Unknown seller",
    })),
    recentDisputes: recentDisputesData.map((dispute) => ({
      _id: dispute._id,
      reason: dispute.reason || "No reason provided",
      status: dispute.status,
      createdAt: dispute.createdAt,
      openerRole: dispute.openerRole,
      openerName: dispute.openerId?.name || "Unknown user",
    })),
    topSellers: topSellersData.map((seller) => ({
      name: seller.name || "Unknown seller",
      orders: seller.orders || 0,
      revenue: Number(parseFloat(roundValue(seller.revenue || 0))),
    })),
  };
};
