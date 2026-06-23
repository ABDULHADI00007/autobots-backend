import mongoose from "mongoose";

const disputeSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
    },
    openerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    openerRole: {
      type: String,
      enum: ["buyer", "seller"],
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["open", "under_review", "resolved"],
      default: "open",
    },
    openedAt: {
      type: Date,
      default: Date.now,
    },
    resolvedAt: {
      type: Date,
    },
    adminDecision: {
      type: String,
      enum: ["release", "refund", "none"],
      default: "none",
    },
    adminNotes: {
      type: String,
      trim: true,
      default: "",
    },
    resolutionDecision: {
      type: String,
      enum: ["buyer_wins", "seller_wins"],
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolutionNotes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

const Dispute = mongoose.model("Dispute", disputeSchema);

export default Dispute;
