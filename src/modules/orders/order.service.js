import Stripe from "stripe";
import Order from "./order.model.js";
import Listing from "../listings/listing.model.js";
import Delivery from "../deliveries/delivery.model.js";
import TimelineEvent from "../timeline/timelineEvent.model.js";
import { env } from "../../config/env.js";
import { createOrderConversation } from "../messages/conversation.service.js";
import { createOrderDelivery as createDeliveryVersion } from "../deliveries/delivery.service.js";


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
  let event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
    console.log("[orders:webhook] signature verification succeeded", { eventType: event.type, eventId: event.id });
  } catch (err) {
    console.error("[orders:webhook] signature verification failed", err?.message || err);
    throw new Error("Webhook signature verification failed");
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    console.log("[orders:webhook] checkout.session.completed received", {
      sessionId: session?.id,
      paymentStatus: session?.payment_status,
      amountTotal: session?.amount_total,
      buyerId: session?.metadata?.buyerId,
      sellerId: session?.metadata?.sellerId,
      listingId: session?.metadata?.listingId,
      stripeSessionId: session?.id,
    });

    const duplicate = await Order.findOne({ stripeSessionId: session.id });
    console.log("[orders:webhook] existingOrder found =", Boolean(duplicate));
    if (duplicate) return { duplicate: true, processed: false };

    const { buyerId, sellerId, listingId } = session.metadata;

    console.log("[orders:webhook] order creation started", {
      buyerId,
      sellerId,
      listingId,
      amount: session.amount_total / 100,
      stripeSessionId: session.id,
    });

    // Create order with funds held (escrow)
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
      console.log("[orders:webhook] order creation success", { orderId: createdOrder._id?.toString?.() || createdOrder._id });

      try {
        await createOrderConversation(createdOrder._id);
        console.log("[orders:webhook] order conversation created", { orderId: createdOrder._id?.toString?.() });
      } catch (convErr) {
        console.error("[orders:webhook] order conversation creation failed (non-fatal)", convErr?.message || convErr);
      }

      return { duplicate: false, processed: true, orderId: createdOrder._id?.toString?.() || createdOrder._id };
    } catch (err) {
      if (err?.code === 11000) {
        console.log("[orders:webhook] duplicate order prevented by unique index", {
          stripeSessionId: session.id,
          stripePaymentIntentId: session.payment_intent || "",
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

export const getAllOrders = async () => {
  return Order.find()
    .populate("listingId", "title slug price")
    .populate("buyerId", "name email")
    .populate("sellerId", "name email");
};

// ── Status Updates / Escrow Flow ─────────────────────────────────────────────

export const acceptOrder = async (orderId, sellerId) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");
  if (order.sellerId.toString() !== sellerId) throw new Error("Access denied");
  if (order.status !== "pending") throw new Error("Order must be pending to accept");

  order.status = "accepted";
  return order.save();
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

  // NOTE: Actual fund transfer to seller (payout) must be handled via Stripe Connect
  // or manual payout. Here we mark the payment as released in DB.

  return order.save();
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

  return order.save();
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
  return order.save({ session });
};

export const adminRefundFunds = async (orderId, session = null) => {
  const order = await Order.findById(orderId).session(session);
  if (!order) throw new Error("Order not found");
  if (order.paymentStatus !== "held") throw new Error("Only held payments can be refunded");
  if (!["delivered", "disputed"].includes(order.status)) {
    throw new Error("Only delivered or disputed orders can be refunded");
  }

  if (order.stripePaymentIntentId) {
    try {
      await stripe.refunds.create({ payment_intent: order.stripePaymentIntentId });
    } catch (err) {
      throw new Error("Stripe refund failed: " + (err.message || err));
    }
  }

  order.paymentStatus = "refunded";
  order.status = "cancelled";
  order.adminDecisionAt = new Date();
  return order.save({ session });
};

export const cancelOrder = async (orderId, userId) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");
  // Allow buyer to cancel only when pending or accepted (per business rules)
  if (order.buyerId.toString() !== userId) throw new Error("Access denied");
  if (!["pending", "accepted"].includes(order.status)) throw new Error("Only pending/accepted orders can be cancelled");

  // Refund if payment held
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
  return order.save();
};
