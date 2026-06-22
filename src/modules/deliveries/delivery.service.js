import Delivery from "./delivery.model.js";
import Order from "../orders/order.model.js";
import TimelineEvent from "../timeline/timelineEvent.model.js";
import { getAttachmentsForParent } from "../attachments/attachment.service.js";

function assertOrderAccess({ order, userId, role }) {
  if (!order) throw new Error("Order not found");
  if (role === "admin") return;

  const buyerId = order.buyerId?._id ?? order.buyerId;
  const sellerId = order.sellerId?._id ?? order.sellerId;
  const isBuyer = buyerId?.toString?.() === userId;
  const isSeller = sellerId?.toString?.() === userId;
  if (!isBuyer && !isSeller) throw new Error("Access denied");
}

function assertSellerCanAccess({ order, userId, role }) {
  if (role === "admin") return;
  const sellerId = order.sellerId?._id ?? order.sellerId;
  if (sellerId?.toString?.() !== userId) throw new Error("Access denied");
}

async function createTimeline({ scopeType, scopeId, actorId, eventType, title, description, payload, visibility }) {
  await TimelineEvent.create({
    scopeType,
    scopeId,
    actorId: actorId || null,
    eventType,
    title,
    description: description || "",
    payload: payload || {},
    visibility: visibility || "participants",
    // occurredAt is auto
  });
}

async function getLatestDelivery(orderId) {
  const deliveries = await Delivery.find({ orderId }).sort({ version: 1 }).lean();
  const latest = deliveries.length ? deliveries[deliveries.length - 1] : null;
  return { deliveries, latest };
}

export async function getOrderDeliveries({ orderId, userId, role }) {
  const order = await Order.findById(orderId).populate("buyerId", "name email").populate("sellerId", "name email");
  assertOrderAccess({ order, userId, role });

  const { deliveries, latest } = await getLatestDelivery(orderId);

  return {
    order: {
      _id: order._id,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      status: order.status,
    },
    attachments: [],
    deliveries: await Promise.all(deliveries.map(async (d) => ({
      _id: d._id,
      orderId: d.orderId,
      version: d.version,
      revisionNumber: d.revisionNumber,
      submittedBy: d.submittedBy,
      summaryNotes: d.summaryNotes,
      links: d.links,
      status: d.status,
      supersedesDeliveryId: d.supersedesDeliveryId,
      acceptedAt: d.acceptedAt,
      replacedAt: d.replacedAt,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      attachments: await getAttachmentsForParent("delivery", d._id),
    }))),
    latestDelivery: latest,
  };
}

export async function getDelivery({ deliveryId, userId, role }) {
  const delivery = await Delivery.findById(deliveryId).lean();
  if (!delivery) throw new Error("Delivery not found");

  const order = await Order.findById(delivery.orderId).populate("buyerId", "name email").populate("sellerId", "name email");
  assertOrderAccess({ order, userId, role });

  const { deliveries: history } = await getLatestDelivery(delivery.orderId);

  return {
    delivery,
    history,
    attachments: await getAttachmentsForParent("delivery", delivery._id),
  };
}

export async function createOrderDelivery({ orderId, submittedBy, role, summaryNotes, links }) {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");

  assertSellerCanAccess({ order, userId: submittedBy, role });

  const { deliveries: existingDeliveries, latest } = await getLatestDelivery(orderId);
  const version = (latest?.version ?? 0) + 1;
  const revisionNumber = order.revisionCount ?? order.revisionHistory?.length ?? 0;
  const supersedesDeliveryId = latest?._id ?? null;

  if (latest?._id) {
    await Delivery.findByIdAndUpdate(latest._id, {
      replacedAt: new Date(),
    });
  }

  const created = await Delivery.create({
    orderId,
    version,
    revisionNumber,
    submittedBy,
    summaryNotes: summaryNotes || "",
    links: Array.isArray(links) ? links : [],
    status: "submitted",
    supersedesDeliveryId,
  });

  const now = new Date();

  if (order.status === "revision_requested") {
    const latestRevision = [...(order.revisionHistory || [])]
      .reverse()
      .find((revision) => revision.status === "requested");

    if (latestRevision) {
      latestRevision.status = "resolved";
      latestRevision.resolvedAt = now;
      latestRevision.sellerResponse = summaryNotes || "";
      latestRevision.deliveryNotes = summaryNotes || "";
    }
  }

  order.status = "delivered";
  order.deliveredAt = now;
  order.deliveryNotes = summaryNotes || "";
  order.reviewDeadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  await order.save();

  // Timeline integration (Deliverables system only records events)
  await createTimeline({
    scopeType: "order",
    scopeId: orderId,
    actorId: submittedBy,
    eventType: "DeliverySubmitted",
    title: "Delivery submitted",
    description: "Seller submitted a deliverable version.",
    visibility: "participants",
    payload: {
      deliveryId: created._id,
      version: created.version,
      revisionNumber: created.revisionNumber,
    },
  });

  return {
    delivery: created,
    latestDelivery: created,
    order: {
      _id: order._id,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      listingId: order.listingId,
      amount: order.amount,
      status: order.status,
      paymentStatus: order.paymentStatus,
      deliveryNotes: order.deliveryNotes,
      deliveredAt: order.deliveredAt,
      reviewDeadline: order.reviewDeadline,
      updatedAt: order.updatedAt,
    },
  };
}

