import mongoose from "mongoose";

const conversationParticipantSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["buyer", "seller", "admin"],
      required: true,
    },
    lastReadAt: {
      type: Date,
      default: null,
    },
    mutedAt: {
      type: Date,
      default: null,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

conversationParticipantSchema.index({ conversationId: 1, userId: 1 }, { unique: true });
conversationParticipantSchema.index({ userId: 1 });

const ConversationParticipant = mongoose.model("ConversationParticipant", conversationParticipantSchema);

export default ConversationParticipant;