import mongoose from "mongoose";
import Listing from "./listing.model.js";
import Category from "../categories/category.model.js";
import SellerApplication from "../sellerApplications/sellerApplication.model.js";
import { storage, STORAGE_FOLDERS } from "../../config/storage/index.js";

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

  // Task 7: Clean up all S3 media before removing the DB record
  const keysToDelete = [
    listing.thumbnailKey,
    ...(listing.galleryKeys || []),
    listing.demoVideoKey,
    listing.documentationKey,
    listing.setupGuideKey,
  ].filter(Boolean);

  if (keysToDelete.length > 0) {
    try {
      const { failed } = await storage.delete.many(keysToDelete);
      if (failed.length > 0) {
        console.warn(
          `[STORAGE] Listing ${listingId} deleted but ${failed.length} media object(s) could not be removed: ` +
          failed.map(f => f.key).join(", ")
        );
      }
    } catch (err) {
      // Non-fatal: DB deletion proceeds regardless, log for manual cleanup
      console.warn(`[STORAGE] Media cleanup failed for listing ${listingId}: ${err.message}`);
    }
  }

  await listing.deleteOne();
  return listing;
};

// ============================================================
// LISTING THUMBNAIL
// ============================================================

/**
 * Uploads or replaces a listing's thumbnail via the Storage Engine.
 * Transaction-safe: new S3 object deleted if DB update fails.
 *
 * @param {string} listingId
 * @param {string} sellerId
 * @param {{ buffer: Buffer, mimeType: string, fileName: string, sizeBytes: number }} file
 * @returns {Promise<object>} Updated listing
 */
export const updateListingThumbnail = async (listingId, sellerId, { buffer, mimeType, fileName, sizeBytes }) => {
  const listing = await getListingOwnedBySeller(listingId, sellerId);
  const previousKey = listing.thumbnailKey || null;

  await storage.replace({
    folder:      STORAGE_FOLDERS.LISTINGS,
    body:        buffer,
    mimeType,
    fileName,
    sizeBytes,
    previousKey,
    constraints: {
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      maxBytes: 8 * 1024 * 1024,
    },
    dbUpdateFn: async (result) => {
      await Listing.findByIdAndUpdate(listingId, {
        thumbnailKey: result.key,
        thumbnailUrl: result.url,
      });
    },
  });

  return Listing.findById(listingId);
};

/**
 * Removes a listing's thumbnail from S3 and clears the DB fields.
 *
 * @param {string} listingId
 * @param {string} sellerId
 * @returns {Promise<object>} Updated listing
 */
export const deleteListingThumbnail = async (listingId, sellerId) => {
  const listing = await getListingOwnedBySeller(listingId, sellerId);
  if (!listing.thumbnailKey) throw createHttpError("No thumbnail to remove", 400);

  await Listing.findByIdAndUpdate(listingId, { thumbnailKey: null, thumbnailUrl: null });

  try {
    await storage.delete.one(listing.thumbnailKey);
  } catch (err) {
    console.warn(`[STORAGE] Thumbnail cleanup failed for listing ${listingId}: ${err.message}`);
  }

  return Listing.findById(listingId);
};

// ============================================================
// LISTING GALLERY
// ============================================================

/**
 * Adds one image to a listing's gallery (max 10 images).
 * Transaction-safe: S3 object removed if DB update fails.
 *
 * @param {string} listingId
 * @param {string} sellerId
 * @param {{ buffer: Buffer, mimeType: string, fileName: string, sizeBytes: number }} file
 * @returns {Promise<object>} Updated listing
 */
export const addListingGalleryImage = async (listingId, sellerId, { buffer, mimeType, fileName, sizeBytes }) => {
  const listing = await getListingOwnedBySeller(listingId, sellerId);

  const currentCount = (listing.galleryKeys || []).length;
  if (currentCount >= 10) {
    throw createHttpError("Gallery is full. Maximum 10 images allowed.", 400);
  }

  const uploadResult = await storage.upload.buffer({
    folder:      STORAGE_FOLDERS.LISTINGS,
    buffer,
    mimeType,
    fileName,
    constraints: {
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      maxBytes: 10 * 1024 * 1024,
    },
  });

  return storage.withTransactionSafety(uploadResult, async () => {
    await Listing.findByIdAndUpdate(listingId, {
      $push: {
        galleryKeys: uploadResult.key,
        galleryUrls: uploadResult.url,
      },
    });
  }).then(() => Listing.findById(listingId));
};

/**
 * Removes one image from a listing's gallery by its S3 key.
 * DB is updated first, S3 deletion is best-effort.
 *
 * @param {string} listingId
 * @param {string} sellerId
 * @param {string} imageKey - The S3 key of the image to remove
 * @returns {Promise<object>} Updated listing
 */
export const removeListingGalleryImage = async (listingId, sellerId, imageKey) => {
  const listing = await getListingOwnedBySeller(listingId, sellerId);

  const keyIndex = (listing.galleryKeys || []).indexOf(imageKey);
  if (keyIndex === -1) throw createHttpError("Image not found in gallery", 404);

  // Build new arrays with the item removed
  const newKeys = listing.galleryKeys.filter((_, i) => i !== keyIndex);
  const newUrls = listing.galleryUrls.filter((_, i) => i !== keyIndex);

  await Listing.findByIdAndUpdate(listingId, {
    galleryKeys: newKeys,
    galleryUrls: newUrls,
  });

  try {
    await storage.delete.one(imageKey);
  } catch (err) {
    console.warn(`[STORAGE] Gallery image cleanup failed for listing ${listingId}, key ${imageKey}: ${err.message}`);
  }

  return Listing.findById(listingId);
};

/**
 * Reorders the gallery by providing the desired key order.
 * Rejects if any submitted key does not belong to this listing.
 *
 * @param {string}   listingId
 * @param {string}   sellerId
 * @param {string[]} orderedKeys - All current gallery keys in the desired order
 * @returns {Promise<object>} Updated listing
 */
export const reorderListingGallery = async (listingId, sellerId, orderedKeys) => {
  const listing = await getListingOwnedBySeller(listingId, sellerId);
  const currentKeys = listing.galleryKeys || [];

  // Validate: submitted keys must exactly match current keys (no additions/removals)
  const currentSet  = new Set(currentKeys);
  const submittedSet = new Set(orderedKeys);

  if (
    orderedKeys.length !== currentKeys.length ||
    orderedKeys.some(k => !currentSet.has(k)) ||
    currentKeys.some(k => !submittedSet.has(k))
  ) {
    throw createHttpError("Reorder keys must exactly match the current gallery keys", 400);
  }

  // Rebuild the URL array in the submitted key order
  const keyToUrl = {};
  currentKeys.forEach((key, i) => { keyToUrl[key] = listing.galleryUrls[i]; });
  const orderedUrls = orderedKeys.map(key => keyToUrl[key]);

  await Listing.findByIdAndUpdate(listingId, {
    galleryKeys: orderedKeys,
    galleryUrls: orderedUrls,
  });

  return Listing.findById(listingId);
};

// ============================================================
// LISTING MEDIA — DEMO VIDEO / DOCUMENTATION / SETUP GUIDE (Phase 11F)
// ============================================================

const MEDIA_FIELD_MAP = {
  demoVideo: {
    keyField:      "demoVideoKey",
    urlField:      "demoVideoUrl",
    fileNameField: "demoVideoFileName",
    mimeTypeField: "demoVideoMimeType",
    sizeBytesField:"demoVideoSizeBytes",
  },
  documentation: {
    keyField:      "documentationKey",
    urlField:      "documentationUrl",
    fileNameField: "documentationFileName",
    mimeTypeField: "documentationMimeType",
    sizeBytesField:"documentationSizeBytes",
  },
  setupGuide: {
    keyField:      "setupGuideKey",
    urlField:      "setupGuideUrl",
    fileNameField: "setupGuideFileName",
    mimeTypeField: "setupGuideMimeType",
    sizeBytesField:"setupGuideSizeBytes",
  },
};

/**
 * Uploads or replaces a listing's media file (demoVideo | documentation | setupGuide).
 * Transaction-safe: new S3 object deleted if DB update fails.
 */
export const uploadListingMedia = async (listingId, sellerId, mediaType, { buffer, mimeType, fileName, sizeBytes }) => {
  const fields = MEDIA_FIELD_MAP[mediaType];
  if (!fields) throw createHttpError(`Unknown media type: ${mediaType}`, 400);

  const listing     = await getListingOwnedBySeller(listingId, sellerId);
  const previousKey = listing[fields.keyField] || null;

  await storage.replace({
    folder:      STORAGE_FOLDERS.LISTINGS,
    body:        buffer,
    mimeType,
    fileName,
    sizeBytes,
    previousKey,
    constraints: { maxBytes: sizeBytes },
    dbUpdateFn: async (result) => {
      await Listing.findByIdAndUpdate(listingId, {
        [fields.keyField]:       result.key,
        [fields.urlField]:       result.url,
        [fields.fileNameField]:  fileName,
        [fields.mimeTypeField]:  mimeType,
        [fields.sizeBytesField]: sizeBytes,
      });
    },
  });

  return Listing.findById(listingId);
};

/**
 * Deletes a listing's media file from S3 and clears the DB fields.
 */
export const deleteListingMedia = async (listingId, sellerId, mediaType) => {
  const fields = MEDIA_FIELD_MAP[mediaType];
  if (!fields) throw createHttpError(`Unknown media type: ${mediaType}`, 400);

  const listing = await getListingOwnedBySeller(listingId, sellerId);
  const key     = listing[fields.keyField];
  if (!key) throw createHttpError(`No ${mediaType} file to remove`, 400);

  await Listing.findByIdAndUpdate(listingId, {
    [fields.keyField]:       null,
    [fields.urlField]:       null,
    [fields.fileNameField]:  null,
    [fields.mimeTypeField]:  null,
    [fields.sizeBytesField]: null,
  });

  try {
    await storage.delete.one(key);
  } catch (err) {
    console.warn(`[STORAGE] ${mediaType} cleanup failed for listing ${listingId}: ${err.message}`);
  }

  return Listing.findById(listingId);
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
