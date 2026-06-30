import mongoose from "mongoose";
import Stripe from "stripe";
import Dispute from "./dispute.model.js";
import Order from "../orders/order.model.js";
import User from "../users/user.model.js";
import {
  sendDisputeOpenedEmailSeller,
  sendAdminDisputeOpenedEmail,
  sendDisputeResolvedEmailParticipant,
} from "../email/marketplace.email.js";
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
    } catch (err) {
      console.error("[disputes:timeline]", { disputeId: dispute._id, eventType: "DisputeOpened", error: err?.message || err });
    }

    // Notify seller and admins about the new dispute
    try {
      const NotificationService = await import("../notifications/notification.service.js");
      try {
        await NotificationService.createNotification({
          userId: openerRole === "buyer" ? order.sellerId : order.buyerId,
          type: "dispute",
          title: "Dispute opened",
          message: `A dispute was opened for order ${order._id}`,
          referenceType: "dispute",
          referenceId: dispute._id,
        });
      } catch (e) { console.error("notify:createDispute:participant", e?.message || e); }

      try {
        await NotificationService.createNotification({
          userId: null,
          broadcastAdmin: true,
          type: "dispute",
          title: "New dispute opened",
          message: `Dispute ${dispute._id} opened for order ${order._id}`,
          referenceType: "dispute",
          referenceId: dispute._id,
        });
      } catch (e) { console.error("notify:createDispute:admin", e?.message || e); }
    } catch (e) {
      console.error("notify:createDispute", e?.message || e);
    }

    try {
      const participant = openerRole === "buyer" ? await User.findById(order.sellerId).select("name email") : await User.findById(order.buyerId).select("name email");
      if (participant?.email) {
        await sendDisputeOpenedEmailSeller({
          seller: participant,
          order,
          openerRole,
        });
      }
    } catch (e) {
      console.error("email:createDispute:participant", e?.message || e);
    }

    try {
      await sendAdminDisputeOpenedEmail({
        order,
        openerRole,
      });
    } catch (e) {
      console.error("email:createDispute:admin", e?.message || e);
    }

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
    .populate("orderId")
    .populate("openerId", "name role");
};

export const getDisputeById = async (disputeId, userId, userRole) => {
  if (!mongoose.Types.ObjectId.isValid(disputeId)) {
    throw new Error("Invalid dispute ID");
  }

  const disputeQuery = Dispute.findById(disputeId)
    .populate("orderId")
    .populate("openerId", "name role");

  if (userRole !== "admin") {
    disputeQuery.select("-adminNotes");
  }

  const dispute = await disputeQuery;
  if (!dispute) throw new Error("Dispute not found");

  if (userRole === "admin") return dispute;

  const order = dispute.orderId;
  const buyerId = order?.buyerId?.toString?.() ?? order?.buyerId;
  const sellerId = order?.sellerId?.toString?.() ?? order?.sellerId;
  const requesterId = userId?.toString();

  if (requesterId !== buyerId?.toString() && requesterId !== sellerId?.toString()) {
    throw new Error("Access denied");
  }

  return dispute;
};

export const getAllDisputes = async () => {
  return Dispute.find().populate("orderId").populate("openerId", "name role");
};

export const getDisputeByOrderId = async (orderId) => {
  if (!mongoose.Types.ObjectId.isValid(orderId)) throw new Error("Invalid order ID");
  const dispute = await Dispute.findOne({ orderId }).select("_id status resolutionDecision openedAt resolvedAt openerRole");
  return dispute ?? null;
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
    } catch (err) {
      console.error("[disputes:timeline]", { disputeId, eventType: "DisputeResolved", error: err?.message || err });
    }

    // Notify participants about dispute resolution
    try {
      const NotificationService = await import("../notifications/notification.service.js");
      const orderDoc = await Order.findById(dispute.orderId);
      const buyerId = orderDoc?.buyerId;
      const sellerId = orderDoc?.sellerId;

      if (internalDecision === "release") {
        // notify seller that funds were released
        try {
          await NotificationService.createNotification({
            userId: sellerId,
            type: "dispute",
            title: "Dispute resolved — funds released",
            message: `Dispute ${disputeId} resolved by admin. Funds released to seller.`,
            referenceType: "dispute",
            referenceId: disputeId,
          });
        } catch (e) { console.error("notify:dispute:release:seller", e?.message || e); }

        try {
          await NotificationService.createNotification({
            userId: buyerId,
            type: "dispute",
            title: "Dispute resolved",
            message: `Dispute ${disputeId} resolved by admin.`,
            referenceType: "dispute",
            referenceId: disputeId,
          });
        } catch (e) { console.error("notify:dispute:release:buyer", e?.message || e); }
      } else {
        // refund
        try {
          await NotificationService.createNotification({
            userId: buyerId,
            type: "refund",
            title: "Refund issued",
            message: `Refund issued for dispute ${disputeId}`,
            referenceType: "dispute",
            referenceId: disputeId,
          });
        } catch (e) { console.error("notify:dispute:refund:buyer", e?.message || e); }

        try {
          await NotificationService.createNotification({
            userId: sellerId,
            type: "dispute",
            title: "Dispute resolved",
            message: `Dispute ${disputeId} resolved by admin.`,
            referenceType: "dispute",
            referenceId: disputeId,
          });
        } catch (e) { console.error("notify:dispute:refund:seller", e?.message || e); }
      }
    } catch (e) {
      console.error("notify:resolveDispute", e?.message || e);
    }

    try {
      const orderDoc = await Order.findById(dispute.orderId).select("buyerId sellerId");
      const [buyer, seller] = await Promise.all([
        User.findById(orderDoc.buyerId).select("name email"),
        User.findById(orderDoc.sellerId).select("name email"),
      ]);

      await Promise.allSettled([
        buyer?.email && sendDisputeResolvedEmailParticipant({ recipient: buyer, order: orderDoc, decision, openerRole }),
        seller?.email && sendDisputeResolvedEmailParticipant({ recipient: seller, order: orderDoc, decision, openerRole }),
      ]);
    } catch (e) {
      console.error("email:resolveDispute", e?.message || e);
    }

    return dispute;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};
