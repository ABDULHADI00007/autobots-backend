import mongoose from "mongoose";

const timelineEventSchema = new mongoose.Schema(
  {
    scopeType: {
      type: String,
      required: true,
      trim: true,
    },
    scopeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    visibility: {
      type: String,
      enum: ["participants", "admin", "internal"],
      default: "participants",
    },
    occurredAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

timelineEventSchema.index({ scopeType: 1, scopeId: 1, occurredAt: 1 });
timelineEventSchema.index({ eventType: 1 });
timelineEventSchema.index({ visibility: 1 });

const TimelineEvent = mongoose.model("TimelineEvent", timelineEventSchema);

export default TimelineEvent;