import Stripe from "stripe";
import * as NotificationService from "../notifications/notification.service.js";
import Order from "./order.model.js";
import Listing from "../listings/listing.model.js";
import Delivery from "../deliveries/delivery.model.js";
import TimelineEvent from "../timeline/timelineEvent.model.js";
import User from "../users/user.model.js";
import {
  sendOrderConfirmationEmail,
  sendNewOrderEmailSeller,
  sendOrderAcceptedEmailBuyer,
  sendOrderDeliveredEmailBuyer,
  sendRevisionRequestedEmailSeller,
  sendCancellationRequestedEmailSeller,
  sendAdminCancellationRequestedEmail,
  sendCancellationApprovedEmailBuyer,
  sendCancellationRejectedEmailBuyer,
  sendRefundApprovedEmailBuyer,
} from "../email/marketplace.email.js";
import { env } from "../../config/env.js";
import { createOrderConversation } from "../messages/conversation.service.js";
import { createOrderDelivery as createDeliveryVersion } from "../deliveries/delivery.service.js";
import { getPaginationValues } from "../../utils/pagination.js";


const stripe = new Stripe(env.STRIPE_SECRET_KEY);

// ── Stripe Checkout ─────────────────────────────────────────────────────────

export const createCheckoutSession = async (buyerId, { listingId }) => {
  const listing = await Listing.findById(listingId);
  if (!listing) throw new Error("Listing not found");
  if (listing.status !== "approved") throw new Error("Listing is not approved");
  if (listing.sellerId.toString() === buyerId) throw new Error("You cannot buy your own listing");

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: listing.title },
          unit_amount: Math.round(listing.price * 100),
        },
        quantity: 1,
      },
    ],
    success_url: `${env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.FRONTEND_URL}/payment-cancelled`,
    metadata: {
      buyerId: buyerId.toString(),
      sellerId: listing.sellerId.toString(),
      listingId: listingId.toString(),
    },
  });

  return { checkoutUrl: session.url };
};

// ── Webhook ──────────────────────────────────────────────────────────────────

export const handleWebhook = async (rawBody, signature) => {
  console.log("[orders:webhook] handleWebhook start", {
    signaturePresent: Boolean(signature),
    rawBodyLength: rawBody ? rawBody.length : 0,
  });

  let event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
    console.log("[orders:webhook] Stripe event constructed", { eventType: event.type, eventId: event.id });
  } catch (err) {
    console.error("[orders:webhook] signature verification failed", err?.message || err, err?.stack || "");
    throw new Error("Webhook signature verification failed");
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    console.log("[orders:webhook] checkout.session.completed received", {
      sessionId: session?.id,
      paymentIntent: session?.payment_intent,
      customer: session?.customer,
      metadata: session?.metadata,
      buyerId: session?.metadata?.buyerId,
      sellerId: session?.metadata?.sellerId,
      listingId: session?.metadata?.listingId,
      amountTotal: session?.amount_total,
      paymentStatus: session?.payment_status,
    });

    const duplicate = await Order.findOne({ stripeSessionId: session.id });
    console.log("[orders:webhook] duplicate check", { duplicate: Boolean(duplicate), stripeSessionId: session.id });
    if (duplicate) {
      console.log("[orders:webhook] skipping duplicate order creation", { stripeSessionId: session.id });
      return { duplicate: true, processed: false };
    }

    const { buyerId, sellerId, listingId } = session.metadata;

    console.log("[orders:webhook] creating order", {
      buyerId,
      sellerId,
      listingId,
      amount: session.amount_total / 100,
      status: "pending",
      paymentStatus: "held",
    });

    try {
      const createdOrder = await Order.create({
        buyerId,
        sellerId,
        listingId,
        amount: session.amount_total / 100,
        paymentStatus: "held",
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent || "",
        status: "pending",
      });
      console.log("[orders:webhook] order creation success", {
        orderId: createdOrder._id?.toString?.() || createdOrder._id,
        buyerId: createdOrder.buyerId,
        sellerId: createdOrder.sellerId,
        listingId: createdOrder.listingId,
      });

      try {
        await TimelineEvent.create({
          scopeType: "order", scopeId: createdOrder._id,
          eventType: "OrderCreated", actorId: buyerId,
          title: "Order created",
          description: "Payment confirmed and funds placed in escrow.",
          payload: { amount: createdOrder.amount, listingId },
          visibility: "participants",
        });
      } catch (_) {}

      try {
        await createOrderConversation(createdOrder._id);
        console.log("[orders:webhook] order conversation created", { orderId: createdOrder._id?.toString?.() });
      } catch (convErr) {
        console.error("[orders:webhook] order conversation creation failed (non-fatal)", convErr?.message || convErr, convErr?.stack || "");
      }

      // Notify seller about the new order
      try {
        await NotificationService.createNotification({
          userId: createdOrder.sellerId,
          type: "order",
          title: "New order received",
          message: `A new order has been placed for your listing`,
          referenceType: "order",
          referenceId: createdOrder._id,
        });
      } catch (e) {
        console.error("notify:newOrder:seller", e?.message || e);
      }

      try {
        const buyer = await User.findById(createdOrder.buyerId).select("name email");
        const seller = await User.findById(createdOrder.sellerId).select("name email");
        await Promise.allSettled([
          sendOrderConfirmationEmail({
            buyer,
            order: createdOrder,
            listingTitle: listing.title,
            amount: createdOrder.amount,
          }),
          sendNewOrderEmailSeller({
            seller,
            order: createdOrder,
            listingTitle: listing.title,
            amount: createdOrder.amount,
            buyerName: buyer?.name || "Buyer",
          }),
        ]);
      } catch (e) {
        console.error("email:newOrder", e?.message || e);
      }

      return { duplicate: false, processed: true, orderId: createdOrder._id?.toString?.() || createdOrder._id };
    } catch (err) {
      if (err?.code === 11000) {
        console.log("[orders:webhook] duplicate order prevented by unique index", {
          stripeSessionId: session.id,
          stripePaymentIntentId: session.payment_intent || "",
          error: err?.message,
        });
        return { duplicate: true, processed: false };
      }

      console.error("[orders:webhook] order creation failed", err?.message || err, err?.stack || "");
      throw err;
    }
  } else if (event.type === "checkout.session.expired") {
    console.log("[orders:webhook] checkout.session.expired received", { sessionId: event.data?.object?.id });
  } else if (event.type === "payment_intent.payment_failed") {
    console.log("[orders:webhook] payment_intent.payment_failed received", { paymentIntentId: event.data?.object?.id });
  } else {
    console.log("[orders:webhook] unhandled event type", event.type);
  }
};

// ── Queries ─────────────────────────────────────────────────────────────────

export const getBuyerOrders = async (buyerId) => {
  return Order.find({ buyerId })
    .populate("listingId", "title slug price")
    .populate("sellerId", "name email");
};

export const getSellerOrders = async (sellerId) => {
  return Order.find({ sellerId })
    .populate("listingId", "title slug price")
    .populate("buyerId", "name email");
};

export const getAllOrders = async ({ page = 1, limit = 20, search = "", status = "", sortBy = "createdAt", sortOrder = "desc" } = {}) => {
  const { page: safePage, limit: safeLimit, skip } = getPaginationValues(page, limit);

  // ── build filter ──────────────────────────────────────────
  const filter = {};
  if (status && status !== "all") filter.status = status;

  // search requires joining — resolve user IDs first if search term present
  if (search && search.trim()) {
    const q = search.trim();
    const objectIdLike = /^[a-f\d]{24}$/i.test(q);
    const User = (await import("../users/user.model.js")).default;
    const userRegex = new RegExp(q, "i");
    const matchedUsers = await User.find({
      $or: [{ name: userRegex }, { email: userRegex }],
    }).select("_id").lean();
    const userIds = matchedUsers.map(u => u._id);

    const searchClauses = [
      { buyerId: { $in: userIds } },
      { sellerId: { $in: userIds } },
    ];
    if (objectIdLike) searchClauses.push({ _id: q });

    // listing title search — find matching listing IDs
    const Listing = (await import("../listings/listing.model.js")).default;
    const matchedListings = await Listing.find({ title: userRegex }).select("_id").lean();
    if (matchedListings.length > 0) {
      searchClauses.push({ listingId: { $in: matchedListings.map(l => l._id) } });
    }

    filter.$or = searchClauses;
  }

  // ── sort ──────────────────────────────────────────────────
  const allowedSortFields = { createdAt: 1, amount: 1, updatedAt: 1 };
  const sortField = allowedSortFields[sortBy] !== undefined ? sortBy : "createdAt";
  const sortDir = sortOrder === "asc" ? 1 : -1;

  const [items, total] = await Promise.all([
    Order.find(filter)
      .sort({ [sortField]: sortDir })
      .skip(skip)
      .limit(safeLimit)
      .populate("listingId", "title slug price")
      .populate("buyerId", "name email")
      .populate("sellerId", "name email")
      .lean(),
    Order.countDocuments(filter),
  ]);

  return { items, total, page: safePage, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) };
};

export const getAdminOrderById = async (orderId) => {
  const order = await Order.findById(orderId)
    .populate("listingId", "title slug price")
    .populate("buyerId", "name email")
    .populate("sellerId", "name email");
  if (!order) throw new Error("Order not found");
  return order;
};

// ── Status Updates / Escrow Flow ─────────────────────────────────────────────

export const acceptOrder = async (orderId, sellerId) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");
  if (order.sellerId.toString() !== sellerId) throw new Error("Access denied");
  if (order.status !== "pending") throw new Error("Order must be pending to accept");

  order.status = "accepted";
  const saved = await order.save();
  await TimelineEvent.create({
    scopeType: "order", scopeId: orderId,
    eventType: "OrderAccepted", actorId: sellerId,
    title: "Order accepted",
    description: "Seller accepted the order and committed to delivery.",
    visibility: "participants",
  });

  // Notify buyer that seller accepted the order
  try {
    await NotificationService.createNotification({
      userId: saved.buyerId,
      type: "order",
      title: "Seller accepted your order",
      message: `Seller accepted order ${saved._id}`,
      referenceType: "order",
      referenceId: saved._id,
    });
  } catch (e) {
    console.error("notify:acceptOrder", e?.message || e);
  }

  try {
    const buyer = await User.findById(saved.buyerId).select("name email");
    const seller = await User.findById(saved.sellerId).select("name email");
    await sendOrderAcceptedEmailBuyer({
      buyer,
      order: saved,
      sellerName: seller?.name || "Seller",
    });
  } catch (e) {
    console.error("email:acceptOrder", e?.message || e);
  }

  return saved;
};


export const deliverOrder = async (orderId, sellerId, deliveryNotes) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");
  if (order.sellerId.toString() !== sellerId) throw new Error("Access denied");
  if (!["accepted", "revision_requested"].includes(order.status)) {
    throw new Error("Only accepted or revision-requested orders can be delivered");
  }
  const payload = await createDeliveryVersion({
    orderId,
    submittedBy: sellerId,
    role: "seller",
    summaryNotes: deliveryNotes || "",
    links: [],
  });

  // Notify buyer that seller delivered the order
  try {
    await NotificationService.createNotification({
      userId: payload.order.buyerId,
      type: "order",
      title: "Order delivered",
      message: `Seller delivered order ${payload.order._id}`,
      referenceType: "order",
      referenceId: payload.order._id,
    });
  } catch (e) {
    console.error("notify:deliverOrder", e?.message || e);
  }

  try {
    const buyer = await User.findById(payload.order.buyerId).select("name email");
    const seller = await User.findById(payload.order.sellerId).select("name email");
    await sendOrderDeliveredEmailBuyer({
      buyer,
      order: payload.order,
      sellerName: seller?.name || "Seller",
    });
  } catch (e) {
    console.error("email:deliverOrder", e?.message || e);
  }

  return payload.order;
};


export const approveDelivery = async (orderId, buyerId) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");
  if (order.buyerId.toString() !== buyerId) throw new Error("Access denied");
  if (order.status !== "delivered") throw new Error("Only delivered orders can be approved");
  if (order.paymentStatus !== "held") throw new Error("Only held payments can be released");

  // Mark latest delivery accepted (artifact-only)
  const latest = await Delivery.find({ orderId }).sort({ version: -1 }).limit(1);
  if (latest?.[0]?._id) {
    await Delivery.findByIdAndUpdate(latest[0]._id, {
      status: "accepted",
      acceptedAt: new Date(),
    });
  }

  await TimelineEvent.create({
    scopeType: "order",
    scopeId: orderId,
    eventType: "DeliveryAccepted",
    actorId: buyerId,
    title: "Delivery accepted",
    description: "Buyer accepted the latest deliverable version.",
    payload: {
      deliveryId: latest?.[0]?._id ?? null,
      version: latest?.[0]?.version ?? null,
      revisionNumber: latest?.[0]?.revisionNumber ?? null,
    },
    visibility: "participants",
  });

  order.status = "completed";
  order.paymentStatus = "released";
  order.completedAt = new Date();
  order.adminDecisionAt = new Date();

  const saved = await order.save();

  await TimelineEvent.create({
    scopeType: "order", scopeId: orderId,
    eventType: "OrderCompleted", actorId: buyerId,
    title: "Order completed",
    description: "Buyer approved the delivery. Funds released to seller.",
    visibility: "participants",
  });

  // Notify seller that order is completed
  try {
    await NotificationService.createNotification({
      userId: order.sellerId,
      type: "order",
      title: "Order completed",
      message: `Order ${order._id} was completed by the buyer`,
      referenceType: "order",
      referenceId: order._id,
    });
  } catch (e) {
    console.error("notify:approveDelivery", e?.message || e);
  }
  return saved;
};



export const requestRevision = async (orderId, buyerId, message) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");
  if (order.buyerId.toString() !== buyerId) throw new Error("Access denied");
  if (order.status !== "delivered") throw new Error("Only delivered orders can request revision");

  const maxRevisions = order.maxRevisions ?? 3;
  const currentRevisionCount = order.revisionCount ?? order.revisionHistory?.length ?? 0;
  if (currentRevisionCount >= maxRevisions) throw new Error("Maximum revisions reached");

  const nextRevisionNumber = currentRevisionCount + 1;
  order.revisionCount = nextRevisionNumber;
  order.maxRevisions = maxRevisions;
  order.revisionHistory = order.revisionHistory || [];
  order.revisionHistory.push({
    revisionNumber: nextRevisionNumber,
    requestedBy: buyerId,
    message: message || "",
    status: "requested",
    requestedAt: new Date(),
  });
  order.status = "revision_requested";

  await TimelineEvent.create({
    scopeType: "order",
    scopeId: orderId,
    eventType: "RevisionRequested",
    actorId: buyerId,
    title: "Revision requested",
    description: "Buyer requested a revision.",
    payload: {
      revisionNumber: nextRevisionNumber,
      message: message || "",
    },
    visibility: "participants",
  });

  const saved = await order.save();

  // Notify seller that buyer requested a revision
  try {
    await NotificationService.createNotification({
      userId: saved.sellerId,
      type: "order",
      title: "Revision requested",
      message: `Buyer requested a revision for order ${saved._id}`,
      referenceType: "order",
      referenceId: saved._id,
    });
  } catch (e) {
    console.error("notify:requestRevision", e?.message || e);
  }

  try {
    const seller = await User.findById(saved.sellerId).select("name email");
    const buyer = await User.findById(saved.buyerId).select("name email");
    await sendRevisionRequestedEmailSeller({
      seller,
      order: saved,
      buyerName: buyer?.name || "Buyer",
    });
  } catch (e) {
    console.error("email:requestRevision", e?.message || e);
  }

  return saved;
};


export const autoReleaseOverdue = async () => {
  // Find delivered orders where reviewDeadline passed and still held and not disputed
  const now = new Date();
  const orders = await Order.find({
    status: "delivered",
    paymentStatus: "held",
    reviewDeadline: { $lte: now },
  });
  let releasedCount = 0;

  for (const order of orders) {
    // Check for disputes - if dispute exists, skip
    const hasDispute = await (await import("../disputes/dispute.model.js")).default.findOne({ orderId: order._id, status: { $ne: "resolved" } });
    if (hasDispute) continue;

    order.paymentStatus = "released";
    order.status = "completed";
    order.completedAt = new Date();
    await order.save();
    try {
      await TimelineEvent.create({
        scopeType: "order", scopeId: order._id,
        eventType: "AutoReleaseTriggered", actorId: null,
        title: "Auto-release triggered",
        description: "Review deadline passed. Funds automatically released to seller.",
        visibility: "participants",
      });
    } catch (_) {}
    releasedCount += 1;
  }

  return releasedCount;
};

export const openDisputeOnOrder = async (orderId, session = null) => {
  const order = await Order.findById(orderId).session(session);
  if (!order) throw new Error("Order not found");
  if (!["delivered", "revision_requested"].includes(order.status)) {
    throw new Error("Only delivered or revision-requested orders can be disputed");
  }

  order.status = "disputed";
  order.disputeOpenedAt = new Date();
  return order.save({ session });
};

// Admin actions
export const adminReleaseFunds = async (orderId, session = null) => {
  const order = await Order.findById(orderId).session(session);
  if (!order) throw new Error("Order not found");
  if (order.paymentStatus !== "held") throw new Error("Only held payments can be released");
  if (!["delivered", "disputed"].includes(order.status)) {
    throw new Error("Only delivered or disputed orders can be released");
  }

  order.paymentStatus = "released";
  order.status = "completed";
  order.adminDecisionAt = new Date();
  order.completedAt = new Date();
  const savedRelease = await order.save({ session });
  try {
    await TimelineEvent.create({
      scopeType: "order", scopeId: orderId,
      eventType: "AdminFundsReleased", actorId: null,
      title: "Funds released by admin",
      description: "Admin manually released funds to seller.",
      visibility: "participants",
    });
  } catch (_) {}
  return savedRelease;
};

const refundHeldOrder = async (order, actorId = null) => {
  if (order.paymentStatus === "held") {
    if (order.stripePaymentIntentId) {
      try {
        await stripe.refunds.create({ payment_intent: order.stripePaymentIntentId });
      } catch (err) {
        throw new Error("Stripe refund failed: " + (err.message || err));
      }
    }
    order.paymentStatus = "refunded";
  }

  order.status = "cancelled";
  order.adminDecisionAt = new Date();
  const saved = await order.save();

  await TimelineEvent.create({
    scopeType: "order", scopeId: order._id,
    eventType: "OrderCancelled", actorId,
    title: "Order cancelled",
    description: "Order was cancelled.",
    visibility: "participants",
  });

  return saved;
};

export const adminRefundFunds = async (orderId, session = null) => {
  const order = await Order.findById(orderId).session(session);
  if (!order) throw new Error("Order not found");
  if (order.paymentStatus !== "held") throw new Error("Only held payments can be refunded");
  if (!["delivered", "disputed"].includes(order.status)) {
    throw new Error("Only delivered or disputed orders can be refunded");
  }

  const savedRefund = await refundHeldOrder(order, null);
  try {
    await TimelineEvent.create({
      scopeType: "order", scopeId: orderId,
      eventType: "AdminFundsRefunded", actorId: null,
      title: "Funds refunded by admin",
      description: "Admin manually issued a refund to buyer.",
      visibility: "participants",
    });
  } catch (_) {}
  // Notify buyer that refund was processed by admin
  try {
    await NotificationService.createNotification({
      userId: savedRefund.buyerId,
      type: "refund",
      title: "Refund processed",
      message: `A refund was issued for order ${savedRefund._id}`,
      referenceType: "order",
      referenceId: savedRefund._id,
    });
  } catch (e) {
    console.error("notify:adminRefundFunds", e?.message || e);
  }

  try {
    const buyer = await User.findById(savedRefund.buyerId).select("name email");
    await sendRefundApprovedEmailBuyer({ buyer, order: savedRefund });
  } catch (e) {
    console.error("email:adminRefundFunds", e?.message || e);
  }

  return savedRefund;
};

export const requestCancellation = async (orderId, buyerId, { reason, notes }) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");
  if (order.buyerId.toString() !== buyerId) throw new Error("Access denied");
  if (order.status !== "accepted") throw new Error("Cancellation requests can only be submitted for accepted orders");
  if (order.cancellationRequested && order.cancellationDecision === "pending") {
    throw new Error("A cancellation request is already pending for this order");
  }

  order.cancellationRequested = true;
  order.cancellationReason = reason;
  order.cancellationNotes = notes || "";
  order.cancellationRequestedBy = buyerId;
  order.cancellationRequestedAt = new Date();
  order.cancellationDecision = "pending";
  order.cancellationDecisionAt = undefined;
  order.cancellationAdminNotes = "";

  const saved = await order.save();
  await TimelineEvent.create({
    scopeType: "order", scopeId: order._id,
    eventType: "CancellationRequested", actorId: buyerId,
    title: "Cancellation requested",
    description: "Buyer submitted a cancellation request.",
    payload: { reason, notes },
    visibility: "participants",
  });
  // Notify seller that buyer requested cancellation
  try {
    await NotificationService.createNotification({
      userId: saved.sellerId,
      type: "order",
      title: "Cancellation requested",
      message: `Buyer requested cancellation for order ${saved._id}`,
      referenceType: "order",
      referenceId: saved._id,
    });
  } catch (e) {
    console.error("notify:requestCancellation", e?.message || e);
  }

  try {
    const seller = await User.findById(saved.sellerId).select("name email");
    const buyer = await User.findById(saved.buyerId).select("name email");
    await sendCancellationRequestedEmailSeller({
      seller,
      order: saved,
      buyerName: buyer?.name || "Buyer",
    });
  } catch (e) {
    console.error("email:requestCancellation", e?.message || e);
  }

  // Notify admin about cancellation request
  try {
    await NotificationService.createNotification({
      userId: null,
      broadcastAdmin: true,
      type: "order",
      title: "Cancellation request submitted",
      message: `Buyer submitted a cancellation request for order ${saved._id}`,
      referenceType: "order",
      referenceId: saved._id,
    });
  } catch (e) {
    console.error("notify:requestCancellation:admin", e?.message || e);
  }

  try {
    await sendAdminCancellationRequestedEmail({
      order: saved,
      buyerName: buyer?.name || "Buyer",
    });
  } catch (e) {
    console.error("email:requestCancellation:admin", e?.message || e);
  }

  return saved;
};

export const approveCancellation = async (orderId, adminId, adminNotes = "") => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");
  if (!order.cancellationRequested || order.cancellationDecision !== "pending") {
    throw new Error("No pending cancellation request exists for this order");
  }
  if (order.status !== "accepted") {
    throw new Error("Only accepted orders with a pending cancellation request can be approved");
  }

  order.cancellationDecision = "approved";
  order.cancellationDecisionAt = new Date();
  order.cancellationAdminNotes = adminNotes;
  await order.save();

  const saved = await refundHeldOrder(order, adminId);
  await TimelineEvent.create({
    scopeType: "order", scopeId: saved._id,
    eventType: "CancellationApproved", actorId: adminId,
    title: "Cancellation approved",
    description: "An administrator approved the cancellation request.",
    payload: { adminNotes },
    visibility: "participants",
  });
  // Notify buyer that cancellation was approved
  try {
    await NotificationService.createNotification({
      userId: saved.buyerId,
      type: "order",
      title: "Cancellation approved",
      message: `Your cancellation for order ${saved._id} was approved`,
      referenceType: "order",
      referenceId: saved._id,
    });
  } catch (e) { console.error("notify:approveCancellation:buyer", e?.message || e); }
  // Notify seller about admin decision
  try {
    await NotificationService.createNotification({
      userId: saved.sellerId,
      type: "order",
      title: "Cancellation approved",
      message: `Cancellation for order ${saved._id} was approved by admin`,
      referenceType: "order",
      referenceId: saved._id,
    });
  } catch (e) { console.error("notify:approveCancellation:seller", e?.message || e); }

  try {
    const buyer = await User.findById(saved.buyerId).select("name email");
    await sendCancellationApprovedEmailBuyer({ buyer, order: saved });
  } catch (e) {
    console.error("email:approveCancellation", e?.message || e);
  }

  return saved;
};

export const rejectCancellation = async (orderId, adminId, adminNotes = "") => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");
  if (!order.cancellationRequested || order.cancellationDecision !== "pending") {
    throw new Error("No pending cancellation request exists for this order");
  }
  if (order.status !== "accepted") {
    throw new Error("Only accepted orders with a pending cancellation request can be rejected");
  }

  order.cancellationDecision = "rejected";
  order.cancellationDecisionAt = new Date();
  order.cancellationAdminNotes = adminNotes;
  const saved = await order.save();

  await TimelineEvent.create({
    scopeType: "order", scopeId: order._id,
    eventType: "CancellationRejected", actorId: adminId,
    title: "Cancellation rejected",
    description: "An administrator rejected the cancellation request.",
    payload: { adminNotes },
    visibility: "participants",
  });
  // Notify buyer that cancellation was rejected
  try {
    await NotificationService.createNotification({
      userId: saved.buyerId,
      type: "order",
      title: "Cancellation rejected",
      message: `Your cancellation for order ${saved._id} was rejected by admin`,
      referenceType: "order",
      referenceId: saved._id,
    });
  } catch (e) { console.error("notify:rejectCancellation:buyer", e?.message || e); }
  // Notify seller about admin decision
  try {
    await NotificationService.createNotification({
      userId: saved.sellerId,
      type: "order",
      title: "Cancellation rejected",
      message: `Cancellation for order ${saved._id} was rejected by admin`,
      referenceType: "order",
      referenceId: saved._id,
    });
  } catch (e) { console.error("notify:rejectCancellation:seller", e?.message || e); }

  try {
    const buyer = await User.findById(saved.buyerId).select("name email");
    await sendCancellationRejectedEmailBuyer({ buyer, order: saved });
  } catch (e) {
    console.error("email:rejectCancellation", e?.message || e);
  }

  return saved;
};

export const cancelOrder = async (orderId, userId) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");
  if (order.buyerId.toString() !== userId) throw new Error("Access denied");
  if (order.status !== "pending") throw new Error("Only pending orders can be cancelled directly");

  const saved = await refundHeldOrder(order, userId);
  return saved;
};
