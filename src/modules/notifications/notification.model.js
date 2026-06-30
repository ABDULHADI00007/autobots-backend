import mongoose from "mongoose";

const { Schema } = mongoose;

const NotificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: false },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: false },
    referenceType: { type: String, required: false },
    referenceId: { type: Schema.Types.ObjectId, required: false },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, read: 1 });

export default mongoose.model("Notification", NotificationSchema);
