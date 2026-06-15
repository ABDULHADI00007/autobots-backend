import Stripe from "stripe";
import Order from "./order.model.js";
import Listing from "../listings/listing.model.js";
import { env } from "../../config/env.js";

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
    success_url: `${env.CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.CLIENT_URL}/payment-cancelled`,
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
  } catch {
    throw new Error("Webhook signature verification failed");
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const duplicate = await Order.findOne({ stripeSessionId: session.id });
    if (duplicate) return;

    const { buyerId, sellerId, listingId } = session.metadata;

    await Order.create({
      buyerId,
      sellerId,
      listingId,
      amount: session.amount_total / 100,
      paymentStatus: "paid",
      stripeSessionId: session.id,
      stripePaymentIntentId: session.payment_intent || "",
      status: "pending",
    });
  }
};

// ── Queries ──────────────────────────────────────────────────────────────────

export const getBuyerOrders = async (buyerId) => {
  return Order.find({ buyerId, paymentStatus: "paid" })
    .populate("listingId", "title slug price")
    .populate("sellerId", "name email");
};

export const getSellerOrders = async (sellerId) => {
  return Order.find({ sellerId, paymentStatus: "paid" })
    .populate("listingId", "title slug price")
    .populate("buyerId", "name email");
};

export const getAllOrders = async () => {
  return Order.find()
    .populate("listingId", "title slug price")
    .populate("buyerId", "name email")
    .populate("sellerId", "name email");
};

// ── Status Updates ───────────────────────────────────────────────────────────

export const acceptOrder = async (orderId, sellerId) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");
  if (order.sellerId.toString() !== sellerId) throw new Error("Access denied");

  order.status = "accepted";
  return order.save();
};

export const completeOrder = async (orderId, sellerId) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");
  if (order.sellerId.toString() !== sellerId) throw new Error("Access denied");

  order.status = "completed";
  return order.save();
};

export const cancelOrder = async (orderId, userId) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");
  if (order.buyerId.toString() !== userId) throw new Error("Access denied");
  if (order.status !== "pending") throw new Error("Only pending orders can be cancelled");

  order.status = "cancelled";
  return order.save();
};
