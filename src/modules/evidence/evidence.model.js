import mongoose from "mongoose";

const evidenceSchema = new mongoose.Schema(
  {
    disputeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dispute",
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    uploaderRole: {
      type: String,
      enum: ["buyer", "seller", "admin"],
      required: true,
    },
    title: {
      type: String,
      trim: true,
      required: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    sourceType: {
      type: String,
      trim: true,
      enum: [
        "screenshot",
        "document",
        "video",
        "archive",
        "chat_export",
        "delivery_export",
        "external_link",
        "other",
      ],
      default: "other",
    },
    // participant-visible: buyer + seller + admin can see
    // admin-only: only admin can see
    // internal-only: only admin can see (internal notes)
    visibility: {
      type: String,
      enum: ["participant-visible", "admin-only", "internal-only"],
      default: "participant-visible",
    },
    // IDs of Attachment docs with parentType="evidence", parentId=this._id
    attachmentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Attachment",
      },
    ],
    verifiedAt: {
      type: Date,
      default: null,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

evidenceSchema.index({ disputeId: 1, createdAt: 1 });
evidenceSchema.index({ uploadedBy: 1 });
evidenceSchema.index({ disputeId: 1, visibility: 1 });

const Evidence = mongoose.model("Evidence", evidenceSchema);

export default Evidence;
