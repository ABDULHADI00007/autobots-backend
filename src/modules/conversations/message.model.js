import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderRole: {
      type: String,
      enum: ["buyer", "seller", "admin"],
      required: true,
    },
    type: {
      type: String,
      enum: ["text", "system", "delivery", "evidence", "admin"],
      required: true,
      default: "text",
    },
    body: {
      type: String,
      trim: true,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    replyToMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    visibility: {
      type: String,
      enum: ["participants", "admin", "internal"],
      default: "participants",
    },
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ senderId: 1, createdAt: 1 });
messageSchema.index({ type: 1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;