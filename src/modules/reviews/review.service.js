import Review from "./review.model.js";
import Order from "../orders/order.model.js";
import Listing from "../listings/listing.model.js";
import User from "../users/user.model.js";
import { sendReviewReceivedEmailSeller } from "../email/marketplace.email.js";
import { getPaginationValues } from "../../utils/pagination.js";

const recalculateRating = async (listingId) => {
  const result = await Review.aggregate([
    { $match: { listingId: listingId, status: "active" } },
    { $group: { _id: "$listingId", averageRating: { $avg: "$rating" }, totalReviews: { $sum: 1 } } },
  ]);

  const averageRating = result.length ? parseFloat(result[0].averageRating.toFixed(1)) : 0;
  const totalReviews = result.length ? result[0].totalReviews : 0;

  await Listing.findByIdAndUpdate(listingId, { averageRating, totalReviews });
};

export const createReview = async (buyerId, { orderId, rating, comment }) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");
  if (order.buyerId.toString() !== buyerId) throw new Error("Access denied");
  if (order.paymentStatus !== "released") throw new Error("Only released orders can be reviewed");
  if (order.status !== "completed") throw new Error("Only completed orders can be reviewed");

  const existing = await Review.findOne({ orderId });
  if (existing) throw new Error("You have already reviewed this order");

  const review = await Review.create({
    buyerId,
    sellerId: order.sellerId,
    listingId: order.listingId,
    orderId,
    rating,
    comment,
    status: "active",
  });

  await recalculateRating(order.listingId);

  // Notify seller about new review
  try {
    const NotificationService = await import("../notifications/notification.service.js");
    try {
      await NotificationService.createNotification({
        userId: order.sellerId,
        type: "review",
        title: "New review received",
        message: `You received a new review for order ${order._id}`,
        referenceType: "review",
        referenceId: review._id,
      });
    } catch (e) { console.error("notify:createReview:seller", e?.message || e); }
  } catch (e) { console.error("notify:createReview", e?.message || e); }

  try {
    const seller = await User.findById(order.sellerId).select("name email");
    await sendReviewReceivedEmailSeller({
      seller,
      order,
      buyerName: order.buyerId?.name || "Buyer",
    });
  } catch (e) {
    console.error("email:createReview", e?.message || e);
  }

  return review;
};

export const getListingReviews = async (listingId) => {
  return Review.find({ listingId, status: "active" })
    .populate("buyerId", "name")
    .select("-__v");
};

export const getMyReviews = async (buyerId) => {
  return Review.find({ buyerId })
    .populate("listingId", "title slug")
    .select("-__v");
};

export const getAllReviews = async ({ page = 1, limit = 20, search = "", status = "all", rating = "all", sortBy = "createdAt", sortOrder = "desc" } = {}) => {
  const { page: safePage, limit: safeLimit, skip } = getPaginationValues(page, limit);

  const filter = {};
  if (status && status !== "all") filter.status = status;
  if (rating !== undefined && rating !== null && rating !== "" && rating !== "all") {
    const parsedRating = Number.parseInt(rating, 10);
    if (!Number.isNaN(parsedRating)) filter.rating = parsedRating;
  }

  if (search && search.trim()) {
    const q = search.trim();
    const objectIdLike = /^[a-f\d]{24}$/i.test(q);
    const regex = new RegExp(q, "i");

    const matchedUsers = await User.find({ $or: [{ name: regex }, { email: regex }] }).select("_id").lean();
    const userIds = matchedUsers.map((user) => user._id);

    const matchedListings = await Listing.find({ title: regex }).select("_id").lean();
    const listingIds = matchedListings.map((listing) => listing._id);

    const searchClauses = [];
    if (objectIdLike) searchClauses.push({ _id: q });
    if (userIds.length) {
      searchClauses.push({ buyerId: { $in: userIds } });
      searchClauses.push({ sellerId: { $in: userIds } });
    }
    if (listingIds.length) searchClauses.push({ listingId: { $in: listingIds } });

    if (searchClauses.length) filter.$or = searchClauses;
  }

  const allowedSortFields = { createdAt: "createdAt", rating: "rating", updatedAt: "updatedAt" };
  const sortField = allowedSortFields[sortBy] ?? "createdAt";
  const sortDir = sortOrder === "asc" ? 1 : -1;

  const [items, total] = await Promise.all([
    Review.find(filter)
      .sort({ [sortField]: sortDir })
      .skip(skip)
      .limit(safeLimit)
      .populate("buyerId", "name email")
      .populate("sellerId", "name email")
      .populate("listingId", "title slug status")
      .populate("orderId", "_id")
      .select("-__v")
      .lean(),
    Review.countDocuments(filter),
  ]);

  return { items, total, page: safePage, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) };
};

export const getReviewById = async (reviewId) => {
  const review = await Review.findById(reviewId)
    .populate("buyerId", "name email")
    .populate("sellerId", "name email")
    .populate("listingId", "title slug status")
    .populate("orderId", "_id")
    .select("-__v");

  if (!review) throw new Error("Review not found");
  return review;
};

export const updateReviewStatus = async (reviewId, status) => {
  const review = await Review.findById(reviewId);
  if (!review) throw new Error("Review not found");

  review.status = status;
  await review.save();

  await recalculateRating(review.listingId);
  return review;
};

export const updateReview = async (reviewId, buyerId, data) => {
  const review = await Review.findById(reviewId);
  if (!review) throw new Error("Review not found");
  if (review.buyerId.toString() !== buyerId) throw new Error("Access denied");

  if (data.rating !== undefined) review.rating = data.rating;
  if (data.comment !== undefined) review.comment = data.comment;
  await review.save();

  await recalculateRating(review.listingId);

  return review;
};

export const deleteReview = async (reviewId, buyerId) => {
  const review = await Review.findById(reviewId);
  if (!review) throw new Error("Review not found");
  if (review.buyerId.toString() !== buyerId) throw new Error("Access denied");

  const listingId = review.listingId;
  await review.deleteOne();

  await recalculateRating(listingId);
};
