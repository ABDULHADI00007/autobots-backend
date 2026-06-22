import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    conversationType: {
      type: String,
      enum: ["order", "dispute"],
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      required() {
        return this.conversationType === "order";
      },
    },
    disputeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dispute",
      default: null,
      required() {
        return this.conversationType === "dispute";
      },
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
    lastMessagePreview: {
      type: String,
      trim: true,
      default: "",
    },
    closedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

conversationSchema.index(
  { orderId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      conversationType: "order",
      orderId: { $type: "objectId" },
    },
  }
);

conversationSchema.index(
  { disputeId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      conversationType: "dispute",
      disputeId: { $type: "objectId" },
    },
  }
);

conversationSchema.index({ lastMessageAt: -1 });

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;