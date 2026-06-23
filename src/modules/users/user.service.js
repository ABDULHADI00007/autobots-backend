import User from "./user.model.js";
import Listing from "../listings/listing.model.js";
import Order from "../orders/order.model.js";
import Dispute from "../disputes/dispute.model.js";
import Refund from "../refunds/refund.model.js";

export const getProfile = async (userId) => {
  const user = await User.findById(userId).select("-password");

  if (!user) {
    throw new Error("User not found");
  }

  return user;
};

export const updateProfile = async (userId, data) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  user.name = data.name;
  await user.save();

  return await User.findById(userId).select("-password");
};

export const updateRole = async (userId, role) => {
  if (!["buyer", "seller"].includes(role)) throw new Error("Invalid role");
  const user = await User.findByIdAndUpdate(userId, { role }, { new: true }).select("-password");
  if (!user) throw new Error("User not found");
  return user;
};

const toBuyerAdminSummary = (user, orders = [], disputes = [], refunds = []) => ({
  ...user.toObject(),
  totalOrders: orders.length,
  totalSpend: orders.reduce((sum, order) => sum + (order.amount || 0), 0),
  disputesOpened: disputes.length,
  refundCount: refunds.length,
  status: user.isSuspended ? "suspended" : "active",
  highRefundActivity: refunds.length >= 2,
  highDisputeActivity: disputes.length >= 2,
});

export const getAdminSellers = async () => {
  const sellers = await User.find({ role: "seller" })
    .select("-password")
    .sort({ createdAt: -1 });

  const withCounts = await Promise.all(sellers.map(async (seller) => {
    const listingCount = await Listing.countDocuments({ sellerId: seller._id });
    return {
      ...seller.toObject(),
      listingCount,
    };
  }));

  return withCounts;
};

export const getAdminSellerById = async (userId) => {
  const seller = await User.findOne({ _id: userId, role: "seller" }).select("-password");
  if (!seller) throw new Error("Seller not found");

  const listingCount = await Listing.countDocuments({ sellerId: seller._id });
  return {
    ...seller.toObject(),
    listingCount,
  };
};

export const getAdminBuyers = async () => {
  const buyers = await User.find({ role: "buyer" })
    .select("-password")
    .sort({ createdAt: -1 });

  const buyerIds = buyers.map((buyer) => buyer._id);
  const [orders, disputes, refunds] = await Promise.all([
    Order.find({ buyerId: { $in: buyerIds } }).select("buyerId amount"),
    Dispute.find({ openerId: { $in: buyerIds }, openerRole: "buyer" }).select("openerId status"),
    Refund.find({ buyerId: { $in: buyerIds } }).select("buyerId status"),
  ]);

  return buyers.map((buyer) => {
    const buyerOrders = orders.filter((order) => order.buyerId?.toString() === buyer._id.toString());
    const buyerDisputes = disputes.filter((dispute) => dispute.openerId?.toString() === buyer._id.toString());
    const buyerRefunds = refunds.filter((refund) => refund.buyerId?.toString() === buyer._id.toString());
    return toBuyerAdminSummary(buyer, buyerOrders, buyerDisputes, buyerRefunds);
  });
};

export const getAdminBuyerById = async (userId) => {
  const buyer = await User.findOne({ _id: userId, role: "buyer" }).select("-password");
  if (!buyer) throw new Error("Buyer not found");

  const [orders, disputes, refunds] = await Promise.all([
    Order.find({ buyerId: buyer._id })
      .populate("listingId", "title slug price")
      .populate("sellerId", "name email")
      .sort({ createdAt: -1 }),
    Dispute.find({ openerId: buyer._id, openerRole: "buyer" })
      .populate("orderId", "_id amount status")
      .sort({ createdAt: -1 }),
    Refund.find({ buyerId: buyer._id })
      .populate("orderId", "_id amount status")
      .sort({ createdAt: -1 }),
  ]);

  const summary = toBuyerAdminSummary(buyer, orders, disputes, refunds);
  return {
    ...summary,
    orders,
    disputes,
    refunds,
    stats: {
      totalOrders: orders.length,
      completedOrders: orders.filter((order) => order.status === "completed").length,
      cancelledOrders: orders.filter((order) => order.status === "cancelled").length,
      totalSpend: orders.reduce((sum, order) => sum + (order.amount || 0), 0),
      openDisputes: disputes.filter((dispute) => dispute.status !== "resolved").length,
      resolvedDisputes: disputes.filter((dispute) => dispute.status === "resolved").length,
      refundRequests: refunds.length,
      approvedRefunds: refunds.filter((refund) => refund.status === "approved").length,
      rejectedRefunds: refunds.filter((refund) => refund.status === "rejected").length,
    },
  };
};

export const suspendBuyer = async (userId, adminId, reason = "") => {
  const buyer = await User.findOne({ _id: userId, role: "buyer" });
  if (!buyer) throw new Error("Buyer not found");

  buyer.isSuspended = true;
  buyer.suspendedAt = new Date();
  buyer.suspendedBy = adminId;
  buyer.suspensionReason = reason.trim();
  await buyer.save();

  return getAdminBuyerById(buyer._id);
};

export const unsuspendBuyer = async (userId) => {
  const buyer = await User.findOne({ _id: userId, role: "buyer" });
  if (!buyer) throw new Error("Buyer not found");

  buyer.isSuspended = false;
  buyer.suspendedAt = null;
  buyer.suspendedBy = null;
  buyer.suspensionReason = "";
  await buyer.save();

  return getAdminBuyerById(buyer._id);
};

export const createBuyerAdminNote = async (userId, adminId, note) => {
  const buyer = await User.findOne({ _id: userId, role: "buyer" });
  if (!buyer) throw new Error("Buyer not found");

  buyer.adminNotes = buyer.adminNotes || [];
  buyer.adminNotes.push({ note, authorId: adminId, createdAt: new Date() });
  await buyer.save();

  return buyer.adminNotes[buyer.adminNotes.length - 1];
};

export const verifySeller = async (userId, adminId, notes = "") => {
  const seller = await User.findOne({ _id: userId, role: "seller" });
  if (!seller) throw new Error("Seller not found");

  seller.verifiedSeller = true;
  seller.verifiedAt = new Date();
  seller.verifiedBy = adminId;
  seller.verificationNotes = notes.trim();
  await seller.save();

  return User.findById(seller._id).select("-password").populate("verifiedBy", "name email");
};

export const unverifySeller = async (userId, notes = "") => {
  const seller = await User.findOne({ _id: userId, role: "seller" });
  if (!seller) throw new Error("Seller not found");

  seller.verifiedSeller = false;
  seller.verifiedAt = null;
  seller.verifiedBy = null;
  seller.verificationNotes = notes.trim();
  await seller.save();

  return User.findById(seller._id).select("-password").populate("verifiedBy", "name email");
};
