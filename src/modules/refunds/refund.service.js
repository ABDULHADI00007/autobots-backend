import mongoose from "mongoose";
import Stripe from "stripe";
import Refund from "./refund.model.js";
import Order from "../orders/order.model.js";
import User from "../users/user.model.js";
import TimelineEvent from "../timeline/timelineEvent.model.js";
import { env } from "../../config/env.js";
import { getPaginationValues } from "../../utils/pagination.js";

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;

const createTimelineEvent = async (refundId, { eventType, title, description, payload = {}, visibility = "admin" }) => {
  return TimelineEvent.create({
    scopeType: "refund",
    scopeId: refundId,
    eventType,
    title,
    description,
    payload,
    visibility,
  });
};

export const createRefund = async (buyerId, { orderId, reason }) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");
  if (order.buyerId.toString() !== buyerId) throw new Error("Access denied");
  if (order.paymentStatus !== "released") throw new Error("Only released orders can be refunded");

  const existing = await Refund.findOne({ orderId });
  if (existing) throw new Error("Refund request already exists for this order");

  const refund = await Refund.create({
    buyerId,
    sellerId: order.sellerId,
    orderId,
    listingId: order.listingId,
    reason,
  });

  await createTimelineEvent(refund._id, {
    eventType: "refund_requested",
    title: "Refund requested",
    description: "The buyer submitted a refund request for this order.",
    payload: { reason },
  });

  return refund;
};

export const getMyRefunds = async (buyerId) => {
  return Refund.find({ buyerId })
    .populate("orderId", "status paymentStatus amount")
    .populate("listingId", "title slug")
    .select("-__v");
};

export const getAllRefunds = async ({ page = 1, limit = 20, search = "", status = "all", sortBy = "createdAt", sortOrder = "desc" } = {}) => {
  const { page: safePage, limit: safeLimit, skip } = getPaginationValues(page, limit);

  const filter = {};
  if (status && status !== "all") filter.status = status;

  const searchClauses = [];
  if (search && search.trim()) {
    const q = search.trim();
    const objectIdLike = /^[a-f\d]{24}$/i.test(q);
    const regex = new RegExp(q, "i");

    const matchedUsers = await User.find({ name: regex }).select("_id").lean();
    const userIds = matchedUsers.map((user) => user._id);

    if (objectIdLike) {
      searchClauses.push({ _id: q });
      searchClauses.push({ orderId: q });
    }
    if (userIds.length) {
      searchClauses.push({ buyerId: { $in: userIds } });
      searchClauses.push({ sellerId: { $in: userIds } });
    }
  }

  if (searchClauses.length) filter.$or = searchClauses;

  const basePipeline = [
    { $match: filter },
    {
      $lookup: {
        from: "users",
        localField: "buyerId",
        foreignField: "_id",
        as: "buyerDoc",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "sellerId",
        foreignField: "_id",
        as: "sellerDoc",
      },
    },
    {
      $lookup: {
        from: "orders",
        localField: "orderId",
        foreignField: "_id",
        as: "orderDoc",
      },
    },
    {
      $lookup: {
        from: "listings",
        localField: "listingId",
        foreignField: "_id",
        as: "listingDoc",
      },
    },
    { $unwind: { path: "$buyerDoc", preserveNullAndEmptyArrays: true } },
    { $unwind: { path: "$sellerDoc", preserveNullAndEmptyArrays: true } },
    { $unwind: { path: "$orderDoc", preserveNullAndEmptyArrays: true } },
    { $unwind: { path: "$listingDoc", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        reason: 1,
        adminNotes: 1,
        status: 1,
        createdAt: 1,
        updatedAt: 1,
        buyerId: {
          _id: "$buyerDoc._id",
          name: "$buyerDoc.name",
          email: "$buyerDoc.email",
        },
        sellerId: {
          _id: "$sellerDoc._id",
          name: "$sellerDoc.name",
          email: "$sellerDoc.email",
        },
        orderId: {
          _id: "$orderDoc._id",
          amount: "$orderDoc.amount",
          status: "$orderDoc.status",
          paymentStatus: "$orderDoc.paymentStatus",
        },
        listingId: {
          _id: "$listingDoc._id",
          title: "$listingDoc.title",
          slug: "$listingDoc.slug",
        },
      },
    },
  ];

  const allowedSortFields = { createdAt: "createdAt", updatedAt: "updatedAt", amount: "orderId.amount" };
  const sortField = allowedSortFields[sortBy] ?? "createdAt";
  const sortDir = sortOrder === "asc" ? 1 : -1;

  const [items, countResult] = await Promise.all([
    Refund.aggregate([...basePipeline, { $sort: { [sortField]: sortDir } }, { $skip: skip }, { $limit: safeLimit }]),
    Refund.aggregate([...basePipeline, { $count: "total" }]),
  ]);

  const total = countResult[0]?.total ?? 0;

  return { items, total, page: safePage, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) };
};

export const getRefundById = async (refundId) => {
  const refund = await Refund.findById(refundId)
    .populate("buyerId", "name email")
    .populate("sellerId", "name email")
    .populate("orderId", "_id amount paymentStatus status")
    .populate("listingId", "title slug")
    .select("-__v")
    .lean();

  if (!refund) throw new Error("Refund request not found");

  const dispute = await mongoose.models.Dispute?.findOne?.({ orderId: refund.orderId?._id ?? refund.orderId })
    .select("_id status reason adminDecision")
    .lean();

  const timeline = await TimelineEvent.find({ scopeType: "refund", scopeId: refund._id })
    .populate("actorId", "name role")
    .sort({ occurredAt: 1 })
    .lean();

  return { refund: { ...refund, dispute }, timeline };
};

export const approveRefund = async (refundId, adminNotes = "") => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const refund = await Refund.findById(refundId).session(session);
    if (!refund) throw new Error("Refund request not found");
    if (refund.status !== "pending") throw new Error("Only pending refunds can be approved");

    refund.status = "processing";
    refund.adminNotes = adminNotes;
    await refund.save({ session });
    await createTimelineEvent(refund._id, {
      eventType: "admin_reviewing",
      title: "Admin reviewing",
      description: "An administrator is reviewing the refund request.",
      visibility: "admin",
    });

    const order = await Order.findById(refund.orderId).session(session);
    if (!order) throw new Error("Order not found");
    if (order.paymentStatus !== "released") {
      throw new Error("Only released orders can be refunded");
    }

    if (stripe && order.stripePaymentIntentId) {
      try {
        await stripe.refunds.create({ payment_intent: order.stripePaymentIntentId });
      } catch (err) {
        throw new Error("Stripe refund failed: " + (err.message || err));
      }
    }

    refund.status = "completed";
    refund.adminNotes = adminNotes;
    await refund.save({ session });

    await createTimelineEvent(refund._id, {
      eventType: "approved",
      title: "Refund approved",
      description: "The refund request was approved by an administrator.",
      visibility: "admin",
    });

    await createTimelineEvent(refund._id, {
      eventType: "payment_refunded",
      title: "Payment refunded",
      description: "The order payment was marked as refunded.",
      visibility: "admin",
    });

    await createTimelineEvent(refund._id, {
      eventType: "completed",
      title: "Refund completed",
      description: "The refund workflow has been completed.",
      visibility: "admin",
    });

    order.paymentStatus = "refunded";
    order.status = "cancelled";
    order.adminDecisionAt = new Date();
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    return refund;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

export const rejectRefund = async (refundId, adminNotes = "") => {
  const refund = await Refund.findById(refundId);
  if (!refund) throw new Error("Refund request not found");
  if (refund.status !== "pending") throw new Error("Only pending refunds can be rejected");

  refund.status = "rejected";
  refund.adminNotes = adminNotes;
  await refund.save();

  await createTimelineEvent(refund._id, {
    eventType: "rejected",
    title: "Refund rejected",
    description: "The refund request was rejected by an administrator.",
    visibility: "admin",
  });

  return refund;
};
