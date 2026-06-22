import Review from "./review.model.js";
import Order from "../orders/order.model.js";
import Listing from "../listings/listing.model.js";

const recalculateRating = async (listingId) => {
  const result = await Review.aggregate([
    { $match: { listingId: listingId } },
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
  });

  await recalculateRating(order.listingId);

  return review;
};

export const getListingReviews = async (listingId) => {
  return Review.find({ listingId })
    .populate("buyerId", "name")
    .select("-__v");
};

export const getMyReviews = async (buyerId) => {
  return Review.find({ buyerId })
    .populate("listingId", "title slug")
    .select("-__v");
};

export const getAllReviews = async () => {
  return Review.find()
    .populate("buyerId", "name email")
    .populate("listingId", "title slug")
    .select("-__v");
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
