import mongoose from "mongoose";
import Stripe from "stripe";
import Refund from "./refund.model.js";
import Order from "../orders/order.model.js";
import { env } from "../../config/env.js";

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export const createRefund = async (buyerId, { orderId, reason }) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");
  if (order.buyerId.toString() !== buyerId) throw new Error("Access denied");
  if (order.paymentStatus !== "released") throw new Error("Only released orders can be refunded");

  const existing = await Refund.findOne({ orderId });
  if (existing) throw new Error("Refund request already exists for this order");

  return Refund.create({
    buyerId,
    sellerId: order.sellerId,
    orderId,
    listingId: order.listingId,
    reason,
  });
};

export const getMyRefunds = async (buyerId) => {
  return Refund.find({ buyerId })
    .populate("orderId", "status paymentStatus amount")
    .populate("listingId", "title slug")
    .select("-__v");
};

export const getAllRefunds = async () => {
  return Refund.find()
    .populate("buyerId", "name email")
    .populate("orderId", "status paymentStatus amount")
    .populate("listingId", "title slug")
    .select("-__v");
};

export const approveRefund = async (refundId, adminNotes = "") => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const refund = await Refund.findById(refundId).session(session);
    if (!refund) throw new Error("Refund request not found");
    if (refund.status !== "pending") throw new Error("Only pending refunds can be approved");

    const order = await Order.findById(refund.orderId).session(session);
    if (!order) throw new Error("Order not found");
    if (order.paymentStatus !== "released") {
      throw new Error("Only released orders can be refunded");
    }

    if (!order.stripePaymentIntentId) {
      throw new Error("Stripe payment intent not found for refund");
    }

    try {
      await stripe.refunds.create({ payment_intent: order.stripePaymentIntentId });
    } catch (err) {
      throw new Error("Stripe refund failed: " + (err.message || err));
    }

    refund.status = "approved";
    refund.adminNotes = adminNotes;
    await refund.save({ session });

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
  return refund.save();
};
