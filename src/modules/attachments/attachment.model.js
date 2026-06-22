import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
  {
    parentType: {
      type: String,
      enum: ["message", "delivery", "evidence"],
      required: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    uploaderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    fileName: {
      type: String,
      trim: true,
      required: true,
    },
    mimeType: {
      type: String,
      trim: true,
      required: true,
    },
    sizeBytes: {
      type: Number,
      min: 0,
      default: 0,
    },
    storageProvider: {
      type: String,
      trim: true,
      required: true,
      default: "local",
    },
    storageKey: {
      type: String,
      trim: true,
      required: true,
    },
    url: {
      type: String,
      trim: true,
      required: true,
    },
    checksum: {
      type: String,
      trim: true,
      required: true,
    },
    visibility: {
      type: String,
      enum: ["participants", "admin", "internal"],
      default: "participants",
    },
    kind: {
      type: String,
      enum: ["file", "link", "image", "video", "document", "archive", "other"],
      default: "file",
    },
  },
  { timestamps: true }
);

attachmentSchema.index({ parentType: 1, parentId: 1 });
attachmentSchema.index({ parentType: 1, parentId: 1, uploaderId: 1 });
attachmentSchema.index({ uploaderId: 1 });
attachmentSchema.index({ checksum: 1 });

const Attachment = mongoose.model("Attachment", attachmentSchema);

export default Attachment;