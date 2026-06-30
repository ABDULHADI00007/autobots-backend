import mongoose from "mongoose";

const sellerApplicationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    portfolio: {
      type: String,
      required: true,
      trim: true,
    },
    experience: {
      type: String,
      required: true,
      trim: true,
    },
    linkedin: {
      type: String,
      trim: true,
      default: "",
    },
    website: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    adminNotes: {
      type: String,
      default: "",
    },
    attemptCount: {
      type: Number,
      default: 1,
    },
    // ── Identity Document (S3) ─────────────────────────────────────
    identityDocKey: {
      type: String,
      default: null,
      trim: true,
    },
    identityDocUrl: {
      type: String,
      default: null,
      trim: true,
    },
    identityDocType: {
      type: String,
      enum: ["cnic", "passport", "national_id", "other"],
      default: null,
    },
    // ── Portfolio File (S3) ───────────────────────────────────────
    portfolioFileKey: {
      type: String,
      default: null,
      trim: true,
    },
    portfolioFileUrl: {
      type: String,
      default: null,
      trim: true,
    },
    // ── Supporting Documents (S3) ────────────────────────────────
    // Each entry: { key, url, label }
    supportingDocKeys: {
      type: [String],
      default: [],
    },
    supportingDocUrls: {
      type: [String],
      default: [],
    },
    supportingDocLabels: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

const SellerApplication = mongoose.model("SellerApplication", sellerApplicationSchema);

export default SellerApplication;
