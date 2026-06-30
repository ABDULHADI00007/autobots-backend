import User from "./user.model.js";
import Listing from "../listings/listing.model.js";
import Order from "../orders/order.model.js";
import Dispute from "../disputes/dispute.model.js";
import Refund from "../refunds/refund.model.js";
import { getPaginationValues, buildPaginationMeta } from "../../utils/pagination.js";
import { storage, STORAGE_FOLDERS } from "../../config/storage/index.js";

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
  if (![ "buyer", "seller"].includes(role)) throw new Error("Invalid role");
  const user = await User.findByIdAndUpdate(userId, { role }, { new: true }).select("-password");
  if (!user) throw new Error("User not found");
  return user;
};

// ============================================================
// USER AVATAR
// ============================================================

/**
 * Uploads or replaces a user's avatar via the Storage Engine.
 * Transaction-safe: if DB update fails, the new S3 object is deleted.
 *
 * @param {string} userId
 * @param {{ buffer: Buffer, mimeType: string, fileName: string, sizeBytes: number }} file
 * @returns {Promise<object>} Updated user (no password)
 */
export const updateAvatar = async (userId, { buffer, mimeType, fileName, sizeBytes }) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const previousKey = user.avatarKey || null;

  const uploadResult = await storage.replace({
    folder:      STORAGE_FOLDERS.AVATARS,
    body:        buffer,
    mimeType,
    fileName,
    sizeBytes,
    previousKey,
    constraints: {
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      maxBytes: 5 * 1024 * 1024, // 5 MB
    },
    dbUpdateFn: async (result) => {
      await User.findByIdAndUpdate(userId, {
        avatarKey: result.key,
        avatarUrl: result.url,
      });
    },
  });

  return User.findById(userId).select("-password");
};

/**
 * Removes a user's avatar from S3 and clears the DB fields.
 *
 * @param {string} userId
 * @returns {Promise<object>} Updated user (no password)
 */
export const deleteAvatar = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  if (!user.avatarKey) throw new Error("No avatar to remove");

  await User.findByIdAndUpdate(userId, { avatarKey: null, avatarUrl: null });

  // Non-fatal: DB is already cleared, S3 cleanup is best-effort
  try {
    await storage.delete.one(user.avatarKey);
  } catch (err) {
    console.warn(`[STORAGE] Avatar cleanup failed for user ${userId}: ${err.message}`);
  }

  return User.findById(userId).select("-password");
};

// ============================================================
// SELLER LOGO
// ============================================================

/**
 * Uploads or replaces a seller's logo via the Storage Engine.
 *
 * @param {string} userId
 * @param {{ buffer: Buffer, mimeType: string, fileName: string, sizeBytes: number }} file
 * @returns {Promise<object>} Updated user (no password)
 */
export const updateSellerLogo = async (userId, { buffer, mimeType, fileName, sizeBytes }) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  if (user.role !== "seller") throw new Error("Only sellers can upload a logo");

  const previousKey = user.sellerLogoKey || null;

  await storage.replace({
    folder:      STORAGE_FOLDERS.SELLER_LOGOS,
    body:        buffer,
    mimeType,
    fileName,
    sizeBytes,
    previousKey,
    constraints: {
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
      maxBytes: 5 * 1024 * 1024,
    },
    dbUpdateFn: async (result) => {
      await User.findByIdAndUpdate(userId, {
        sellerLogoKey: result.key,
        sellerLogoUrl: result.url,
      });
    },
  });

  return User.findById(userId).select("-password");
};

/**
 * Removes a seller's logo from S3 and clears the DB fields.
 *
 * @param {string} userId
 * @returns {Promise<object>} Updated user (no password)
 */
export const deleteSellerLogo = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  if (!user.sellerLogoKey) throw new Error("No logo to remove");

  await User.findByIdAndUpdate(userId, { sellerLogoKey: null, sellerLogoUrl: null });

  try {
    await storage.delete.one(user.sellerLogoKey);
  } catch (err) {
    console.warn(`[STORAGE] Logo cleanup failed for user ${userId}: ${err.message}`);
  }

  return User.findById(userId).select("-password");
};

// ============================================================
// SELLER BANNER
// ============================================================

/**
 * Uploads or replaces a seller's banner via the Storage Engine.
 *
 * @param {string} userId
 * @param {{ buffer: Buffer, mimeType: string, fileName: string, sizeBytes: number }} file
 * @returns {Promise<object>} Updated user (no password)
 */
export const updateSellerBanner = async (userId, { buffer, mimeType, fileName, sizeBytes }) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  if (user.role !== "seller") throw new Error("Only sellers can upload a banner");

  const previousKey = user.sellerBannerKey || null;

  await storage.replace({
    folder:      STORAGE_FOLDERS.SELLER_LOGOS, // reuse seller-logos folder, key prefix differs
    body:        buffer,
    mimeType,
    fileName,
    sizeBytes,
    previousKey,
    constraints: {
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      maxBytes: 8 * 1024 * 1024, // 8 MB for banner
    },
    dbUpdateFn: async (result) => {
      await User.findByIdAndUpdate(userId, {
        sellerBannerKey: result.key,
        sellerBannerUrl: result.url,
      });
    },
  });

  return User.findById(userId).select("-password");
};

/**
 * Removes a seller's banner from S3 and clears the DB fields.
 *
 * @param {string} userId
 * @returns {Promise<object>} Updated user (no password)
 */
export const deleteSellerBanner = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  if (!user.sellerBannerKey) throw new Error("No banner to remove");

  await User.findByIdAndUpdate(userId, { sellerBannerKey: null, sellerBannerUrl: null });

  try {
    await storage.delete.one(user.sellerBannerKey);
  } catch (err) {
    console.warn(`[STORAGE] Banner cleanup failed for user ${userId}: ${err.message}`);
  }

  return User.findById(userId).select("-password");
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

export const getAdminUsers = async () => {
  return User.find({ role: "admin" })
    .select("_id name email role")
    .sort({ name: 1 });
};

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

export const getAdminBuyers = async (query = {}) => {
  const {
    search = "",
    status = "all",
    risk = [],
    sortBy = "createdAt",
    sortOrder = "desc",
    page = 1,
    limit = 20,
  } = query;

  const buyers = await User.find({ role: "buyer" })
    .select("-password")
    .sort({ createdAt: -1 });

  const buyerIds = buyers.map((buyer) => buyer._id);
  const [orders, disputes, refunds] = await Promise.all([
    Order.find({ buyerId: { $in: buyerIds } }).select("buyerId amount"),
    Dispute.find({ openerId: { $in: buyerIds }, openerRole: "buyer" }).select("openerId status"),
    Refund.find({ buyerId: { $in: buyerIds } }).select("buyerId status"),
  ]);

  const summaries = buyers
    .map((buyer) => {
      const buyerOrders = orders.filter((order) => order.buyerId?.toString() === buyer._id.toString());
      const buyerDisputes = disputes.filter((dispute) => dispute.openerId?.toString() === buyer._id.toString());
      const buyerRefunds = refunds.filter((refund) => refund.buyerId?.toString() === buyer._id.toString());
      return toBuyerAdminSummary(buyer, buyerOrders, buyerDisputes, buyerRefunds);
    })
    .filter((buyer) => {
      const searchText = search.trim().toLowerCase();
      const matchesSearch = !searchText || buyer.name.toLowerCase().includes(searchText) || buyer.email.toLowerCase().includes(searchText);
      const matchesStatus = status === "all" || (status === "active" ? buyer.status === "active" : buyer.status === "suspended");
      const matchesRisk = risk.length === 0 || risk.some((filter) => filter === "highRefund" ? buyer.highRefundActivity : buyer.highDisputeActivity);
      return matchesSearch && matchesStatus && matchesRisk;
    });

  const direction = sortOrder === "asc" ? 1 : -1;
  const sorted = [...summaries].sort((left, right) => {
    const getValue = (buyer) => {
      switch (sortBy) {
        case "name":
          return buyer.name.toLowerCase();
        case "email":
          return buyer.email.toLowerCase();
        case "totalOrders":
          return buyer.totalOrders;
        case "totalSpend":
          return buyer.totalSpend;
        case "disputesOpened":
          return buyer.disputesOpened;
        case "refundCount":
          return buyer.refundCount;
        default:
          return new Date(buyer.createdAt).getTime();
      }
    };

    const leftValue = getValue(left);
    const rightValue = getValue(right);
    if (leftValue < rightValue) return -1 * direction;
    if (leftValue > rightValue) return 1 * direction;
    return 0;
  });

  const { page: safePage, limit: safeLimit, skip } = getPaginationValues(page, limit);
  const paginatedItems = sorted.slice(skip, skip + safeLimit);

  return {
    items: paginatedItems,
    pagination: buildPaginationMeta(safePage, safeLimit, sorted.length),
  };
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
