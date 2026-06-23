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
  },
  { timestamps: true }
);

listingSchema.index({ title: "text", outcome: "text", shortDescription: "text" });
listingSchema.index({ status: 1, categoryId: 1, difficultyLevel: 1, verificationStatus: 1 });

const Listing = mongoose.model("Listing", listingSchema);

export default Listing;
