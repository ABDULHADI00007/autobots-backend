import mongoose from "mongoose";
import Stripe from "stripe";
import Dispute from "./dispute.model.js";
import Order from "../orders/order.model.js";
import { env } from "../../config/env.js";
import { createDisputeConversation } from "../messages/conversation.service.js";
import TimelineEvent from "../timeline/timelineEvent.model.js";

const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const DISPUTABLE_ORDER_STATUSES = ["delivered", "revision_requested"];

export const createDispute = async ({ orderId, openerId, openerRole, reason }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Ensure order exists (in txn)
    const order = await Order.findById(orderId).session(session);
    if (!order) {
      throw new Error("Order not found");
    }

    // Only buyers or sellers may open disputes
    if (!["buyer", "seller"].includes(openerRole)) {
      throw new Error("Access denied");
    }

    // Ownership validation
    if (openerRole === "buyer" && order.buyerId.toString() !== openerId.toString()) {
      throw new Error("Access denied");
    }
    if (openerRole === "seller" && order.sellerId.toString() !== openerId.toString()) {
      throw new Error("Access denied");
    }

    // Duplicate dispute check
    const existingDispute = await Dispute.findOne({ orderId, status: { $ne: "resolved" } }).session(session);
    if (existingDispute) {
      throw new Error("An active dispute already exists for this order");
    }

    // Order status validation
    if (!DISPUTABLE_ORDER_STATUSES.includes(order.status)) {
      throw new Error("Only delivered or revision-requested orders can be disputed");
    }

    // Create dispute record (within txn)
    const dispute = new Dispute({
      orderId,
      openerId,
      openerRole,
      reason,
      status: "open",
      openedAt: new Date(),
    });
    await dispute.save({ session });

    // Mark order as disputed (update within txn)
    order.status = "disputed";
    order.disputeOpenedAt = new Date();
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    try {
      await createDisputeConversation(dispute._id);
    } catch (convErr) {
      console.error("[disputes:createDispute] dispute conversation creation failed (non-fatal)", convErr?.message || convErr);
    }

    try {
      await TimelineEvent.create({
        scopeType: "dispute", scopeId: dispute._id,
        eventType: "DisputeOpened", actorId: openerId,
        title: "Dispute opened",
        description: `Dispute opened by ${openerRole}.`,
        payload: { openerRole, reason },
        visibility: "participants",
      });
    } catch (_) {}

    return dispute;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

export const getMyDisputes = async (userId, userRole) => {
  if (userRole === "admin") {
    return getAllDisputes();
  }

  const orderQuery = {};

  if (userRole === "buyer") {
    orderQuery.buyerId = userId;
  } else if (userRole === "seller") {
    orderQuery.sellerId = userId;
  } else {
    throw new Error("Access denied");
  }

  const orders = await Order.find(orderQuery).select("_id");
  const orderIds = orders.map(order => order._id);

  return Dispute.find({ orderId: { $in: orderIds } })
    .select("-adminNotes")
    .populate("orderId");
};

export const getAllDisputes = async () => {
  return Dispute.find().populate("orderId");
};

export const resolveDispute = async (disputeId, decision, adminNotes, adminId = null) => {
  // Decision validation
  if (!["release", "refund"].includes(decision)) {
    throw new Error("Invalid dispute decision");
  }

  const internalDecision = decision === "refund" ? "buyer_wins" : "seller_wins";
  return resolveDisputeFinal(disputeId, internalDecision, adminNotes || "", adminId);
};

export const resolveDisputeFinal = async (disputeId, decision, notes, adminId) => {
  const internalDecision = decision === "buyer_wins" ? "refund" : "release";

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const dispute = await Dispute.findById(disputeId).session(session);
    if (!dispute) throw new Error("Dispute not found");
    if (dispute.status === "resolved") throw new Error("Dispute already resolved");

    const order = await Order.findById(dispute.orderId).session(session);
    if (!order) throw new Error("Order not found");

    if (internalDecision === "release") {
      if (order.paymentStatus !== "held") throw new Error("Only held payments can be released");
      order.paymentStatus = "released";
      order.status = "completed";
      order.adminDecisionAt = new Date();
      order.completedAt = new Date();
      dispute.adminDecision = "release";
    } else {
      if (order.paymentStatus !== "held") throw new Error("Only held payments can be refunded");
      if (order.stripePaymentIntentId) {
        try {
          await stripe.refunds.create({ payment_intent: order.stripePaymentIntentId });
        } catch (stripeErr) {
          throw new Error("Stripe refund failed: " + (stripeErr.message || stripeErr));
        }
      }
      order.paymentStatus = "refunded";
      order.status = "cancelled";
      order.adminDecisionAt = new Date();
      dispute.adminDecision = "refund";
    }

    dispute.status = "resolved";
    dispute.resolutionDecision = decision;
    dispute.resolutionNotes = notes;
    dispute.resolvedBy = adminId;
    dispute.resolvedAt = new Date();
    dispute.adminNotes = notes;

    await order.save({ session });
    await dispute.save({ session });
    await session.commitTransaction();
    session.endSession();

    const decisionEventType = internalDecision === "release" ? "FundsReleased" : "RefundIssued";
    const decisionTitle = internalDecision === "release" ? "Funds released to seller" : "Refund issued to buyer";
    const winnerLabel = decision === "buyer_wins" ? "Buyer wins" : "Seller wins";

    try {
      await TimelineEvent.create([
        {
          scopeType: "dispute", scopeId: disputeId,
          eventType: "DisputeResolved", actorId: adminId,
          title: "Dispute resolved",
          description: `Admin resolved the dispute. ${winnerLabel}.`,
          payload: { resolutionDecision: decision, notes },
          visibility: "participants",
        },
        {
          scopeType: "dispute", scopeId: disputeId,
          eventType: decisionEventType, actorId: adminId,
          title: decisionTitle,
          description: decisionTitle + ".",
          payload: { resolutionDecision: decision },
          visibility: "participants",
        },
      ]);
    } catch (_err) {}

    return dispute;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};
