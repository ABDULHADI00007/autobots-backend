import mongoose from "mongoose";

const investigationSchema = new mongoose.Schema(
  {
    disputeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dispute",
      required: true,
      unique: true,
    },
    status: {
      type: String,
      trim: true,
      required: true,
      default: "open",
    },
    assignedAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    priority: {
      type: String,
      trim: true,
      default: "medium",
    },
    summary: {
      type: String,
      trim: true,
      default: "",
    },
    openedAt: {
      type: Date,
      default: Date.now,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
    resolutionType: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

investigationSchema.index({ status: 1 });
investigationSchema.index({ assignedAdminId: 1 });
investigationSchema.index({ priority: 1 });

const Investigation = mongoose.model("Investigation", investigationSchema);

export default Investigation;