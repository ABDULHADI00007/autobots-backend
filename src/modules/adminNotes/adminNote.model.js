import mongoose from "mongoose";

const adminNoteSchema = new mongoose.Schema(
  {
    investigationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Investigation",
      required: true,
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: {
      type: String,
      trim: true,
      default: "general",
    },
    note: {
      type: String,
      trim: true,
      required: true,
    },
    pinned: {
      type: Boolean,
      default: false,
    },
    visibility: {
      type: String,
      enum: ["internal"],
      default: "internal",
    },
  },
  { timestamps: true }
);

adminNoteSchema.index({ investigationId: 1, createdAt: 1 });
adminNoteSchema.index({ adminId: 1 });
adminNoteSchema.index({ category: 1 });

const AdminNote = mongoose.model("AdminNote", adminNoteSchema);

export default AdminNote;