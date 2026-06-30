import mongoose from "mongoose";

const listingSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    outcome: {
      type: String,
      required: true,
      trim: true,
    },
    shortDescription: {
      type: String,
      required: true,
      trim: true,
    },
    fullDescription: {
      type: String,
      required: true,
      trim: true,
    },
    difficultyLevel: {
      type: String,
      enum: ["easy", "moderate", "advanced"],
      required: true,
    },
    requiredTools: {
      type: [String],
      default: [],
    },
    monthlySoftwareCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    demoVideo: {
      type: String,
      trim: true,
      default: "",
    },
    documentation: {
      type: String,
      trim: true,
      default: "",
    },
    setupGuide: {
      type: String,
      trim: true,
      default: "",
    },
    estimatedOutcomes: {
      type: String,
      trim: true,
      default: "",
    },
    deliverables: {
      type: [String],
      default: [],
    },
    verificationStatus: {
      type: String,
      enum: ["verified", "unverified"],
      default: "unverified",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "changes_requested", "hidden"],
      default: "pending",
    },
    moderationFeedback: {
      type: String,
      trim: true,
      default: "",
    },
    moderationUpdatedAt: {
      type: Date,
      default: null,
    },
    averageRating: {
      type: Number,
      default: 0,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    // ── Listing Thumbnail (S3) ──────────────────────────────────
    thumbnailKey: {
      type: String,
      default: null,
      trim: true,
    },
    thumbnailUrl: {
      type: String,
      default: null,
      trim: true,
    },
    // ── Listing Gallery (S3) ────────────────────────────────────
    galleryKeys: {
      type: [String],
      default: [],
    },
    galleryUrls: {
      type: [String],
      default: [],
    },
    // ── Listing Media — S3 (Phase 11F) ──────────────────────────
    demoVideoKey: { type: String, default: null, trim: true },
    demoVideoUrl: { type: String, default: null, trim: true },
    demoVideoFileName: { type: String, default: null, trim: true },
    demoVideoMimeType: { type: String, default: null, trim: true },
    demoVideoSizeBytes: { type: Number, default: null },

    documentationKey: { type: String, default: null, trim: true },
    documentationUrl: { type: String, default: null, trim: true },
    documentationFileName: { type: String, default: null, trim: true },
    documentationMimeType: { type: String, default: null, trim: true },
    documentationSizeBytes: { type: Number, default: null },

    setupGuideKey: { type: String, default: null, trim: true },
    setupGuideUrl: { type: String, default: null, trim: true },
    setupGuideFileName: { type: String, default: null, trim: true },
    setupGuideMimeType: { type: String, default: null, trim: true },
    setupGuideSizeBytes: { type: Number, default: null },
  },
  { timestamps: true }
);

listingSchema.index({ title: "text", outcome: "text", shortDescription: "text" });
listingSchema.index({ status: 1, categoryId: 1, difficultyLevel: 1, verificationStatus: 1 });

const Listing = mongoose.model("Listing", listingSchema);

export default Listing;
