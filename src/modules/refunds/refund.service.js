import Refund from "./refund.model.js";
import Order from "../orders/order.model.js";

export const createRefund = async (buyerId, { orderId, reason }) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");
  if (order.buyerId.toString() !== buyerId) throw new Error("Access denied");
  if (order.paymentStatus !== "paid") throw new Error("Only paid orders can be refunded");

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
  const refund = await Refund.findById(refundId);
  if (!refund) throw new Error("Refund request not found");
  if (refund.status !== "pending") throw new Error("Only pending refunds can be approved");

  refund.status = "approved";
  refund.adminNotes = adminNotes;
  await refund.save();

  await Order.findByIdAndUpdate(refund.orderId, { paymentStatus: "refunded" });

  return refund;
};

export const rejectRefund = async (refundId, adminNotes = "") => {
  const refund = await Refund.findById(refundId);
  if (!refund) throw new Error("Refund request not found");
  if (refund.status !== "pending") throw new Error("Only pending refunds can be rejected");

  refund.status = "rejected";
  refund.adminNotes = adminNotes;
  return refund.save();
};
