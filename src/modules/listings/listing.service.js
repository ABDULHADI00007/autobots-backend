import mongoose from "mongoose";
import Listing from "./listing.model.js";
import Category from "../categories/category.model.js";
import SellerApplication from "../sellerApplications/sellerApplication.model.js";

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const createSlug = (title) => {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const generateUniqueSlug = async (title, ignoredListingId = null) => {
  const baseSlug = createSlug(title);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const query = { slug };
    if (ignoredListingId) {
      query._id = { $ne: ignoredListingId };
    }

    const existing = await Listing.findOne(query).select("_id");
    if (!existing) return slug;

    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
};

const ensureCategoryExists = async (categoryId) => {
  const category = await Category.findOne({ _id: categoryId, isActive: true });
  if (!category) throw createHttpError("Category not found", 404);
};

const ensureApprovedSeller = async (sellerId) => {
  const application = await SellerApplication.findOne({
    userId: sellerId,
    status: "approved",
  });

  if (!application) {
    throw createHttpError("Approved seller application is required", 403);
  }
};

const getListingOwnedBySeller = async (listingId, sellerId) => {
  const listing = await Listing.findById(listingId);
  if (!listing) throw createHttpError("Listing not found", 404);

  if (listing.sellerId.toString() !== sellerId.toString()) {
    throw createHttpError("You can only manage your own listings", 403);
  }

  return listing;
};

export const getModerationStatus = (action) => {
  switch (action) {
    case "approve":
      return "approved";
    case "request_changes":
      return "changes_requested";
    case "hide":
      return "hidden";
    case "unhide":
      return "approved";
    case "reject":
      return "rejected";
    default:
      return "pending";
  }
};

export const createListing = async (sellerId, data) => {
  await ensureApprovedSeller(sellerId);
  await ensureCategoryExists(data.categoryId);

  const slug = await generateUniqueSlug(data.title);

  return Listing.create({
    ...data,
    sellerId,
    slug,
    status: "pending",
    verificationStatus: "unverified",
  });
};

export const getPublicListings = async (query) => {
  const { page, limit, search, category, difficulty, verificationStatus } = query;
  const filter = { status: "approved" };

  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { outcome: { $regex: search, $options: "i" } },
      { shortDescription: { $regex: search, $options: "i" } },
    ];
  }

  if (category) {
    if (mongoose.Types.ObjectId.isValid(category)) {
      filter.categoryId = category;
    } else {
      const matchedCategory = await Category.findOne({ slug: category, isActive: true }).select("_id");
      filter.categoryId = matchedCategory?._id || null;
    }
  }

  if (difficulty) filter.difficultyLevel = difficulty;
  if (verificationStatus) filter.verificationStatus = verificationStatus;

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Listing.find(filter)
      .populate("sellerId", "name email role verifiedSeller")
      .populate("categoryId", "name slug description")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-__v"),
    Listing.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

export const getPublicListingBySlug = async (slug) => {
  const listing = await Listing.findOne({ slug, status: "approved" })
    .populate("sellerId", "name email role verifiedSeller")
    .populate("categoryId", "name slug description")
    .select("-__v");

  if (!listing) throw createHttpError("Listing not found", 404);
  return listing;
};

export const getMyListings = async (sellerId) => {
  return Listing.find({ sellerId })
    .populate("sellerId", "name email role verifiedSeller")
    .populate("categoryId", "name slug description")
    .sort({ createdAt: -1 })
    .select("-__v");
};

export const updateListing = async (listingId, sellerId, data) => {
  const listing = await getListingOwnedBySeller(listingId, sellerId);

  if (data.categoryId) {
    await ensureCategoryExists(data.categoryId);
  }

  if (data.title && data.title !== listing.title) {
    listing.slug = await generateUniqueSlug(data.title, listing._id);
  }

  Object.assign(listing, data, {
    status: "pending",
    moderationFeedback: "",
    moderationUpdatedAt: new Date(),
  });
  await listing.save();

  return listing;
};

export const deleteListing = async (listingId, sellerId) => {
  const listing = await getListingOwnedBySeller(listingId, sellerId);
  await listing.deleteOne();
  return listing;
};

export const getAllListingsForAdmin = async () => {
  return Listing.find()
    .populate("sellerId", "name email role verifiedSeller")
    .populate("categoryId", "name slug description")
    .sort({ createdAt: -1 })
    .select("-__v");
};

export const moderateListing = async (listingId, action, feedback = "") => {
  const listing = await Listing.findById(listingId);
  if (!listing) throw createHttpError("Listing not found", 404);

  const nextStatus = getModerationStatus(action);
  listing.status = nextStatus;
  listing.moderationFeedback = feedback?.trim() || "";
  listing.moderationUpdatedAt = new Date();

  if (action === "approve" || action === "unhide") {
    listing.verificationStatus = "verified";
  } else if (action === "request_changes" || action === "reject" || action === "hide") {
    listing.verificationStatus = "unverified";
  }

  await listing.save();
  return listing;
};

export const approveListing = async (listingId, feedback = "") => {
  return moderateListing(listingId, "approve", feedback);
};

export const rejectListing = async (listingId, feedback = "") => {
  return moderateListing(listingId, "reject", feedback);
};

export const requestChangesListing = async (listingId, feedback = "") => {
  return moderateListing(listingId, "request_changes", feedback);
};

export const hideListing = async (listingId, feedback = "") => {
  return moderateListing(listingId, "hide", feedback);
};

export const unhideListing = async (listingId, feedback = "") => {
  return moderateListing(listingId, "unhide", feedback);
};
