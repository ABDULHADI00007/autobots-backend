import TimelineEvent from "./timelineEvent.model.js";
import Order from "../orders/order.model.js";
import Dispute from "../disputes/dispute.model.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function visibilityFilter(role) {
  if (role === "admin") return {};
  return { visibility: "participants" };
}

function parsePagination(query) {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit) || DEFAULT_LIMIT));
  return { page, limit, skip: (page - 1) * limit };
}

export const getOrderTimeline = async (orderId, userId, role, query = {}) => {
  const order = await Order.findById(orderId).select("buyerId sellerId");
  if (!order) throw new Error("Order not found");

  if (role !== "admin") {
    const buyerId  = order.buyerId?.toString();
    const sellerId = order.sellerId?.toString();
    if (userId !== buyerId && userId !== sellerId) throw new Error("Access denied");
  }

  const filter = { scopeType: "order", scopeId: orderId, ...visibilityFilter(role) };
  const { page, limit, skip } = parsePagination(query);

  const [items, total] = await Promise.all([
    TimelineEvent.find(filter)
      .populate("actorId", "name role")
      .sort({ occurredAt: 1 })
      .skip(skip)
      .limit(limit),
    TimelineEvent.countDocuments(filter),
  ]);

  return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
};

export const getDisputeTimeline = async (disputeId, userId, role, query = {}) => {
  const dispute = await Dispute.findById(disputeId).populate("orderId", "buyerId sellerId");
  if (!dispute) throw new Error("Dispute not found");

  if (role !== "admin") {
    const order   = dispute.orderId;
    const buyerId  = order?.buyerId?.toString?.()  ?? order?.buyerId?.toString();
    const sellerId = order?.sellerId?.toString?.() ?? order?.sellerId?.toString();
    if (userId !== buyerId && userId !== sellerId) throw new Error("Access denied");
  }

  const filter = { scopeType: "dispute", scopeId: disputeId, ...visibilityFilter(role) };
  const { page, limit, skip } = parsePagination(query);

  const [items, total] = await Promise.all([
    TimelineEvent.find(filter)
      .populate("actorId", "name role")
      .sort({ occurredAt: 1 })
      .skip(skip)
      .limit(limit),
    TimelineEvent.countDocuments(filter),
  ]);

  return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
};
