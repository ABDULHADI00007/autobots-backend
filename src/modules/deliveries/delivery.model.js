import mongoose from "mongoose";

const deliverySchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },

    // Versioning
    version: {
      type: Number,
      required: true,
      min: 1,
      index: true,
    },

    revisionNumber: {
      type: Number,
      required: true,
      min: 0,
      index: true,
    },

    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    summaryNotes: {
      type: String,
      trim: true,
      default: "",
    },

    links: {
      type: [String],
      default: [],
    },

    // delivery lifecycle (artifact only)
    status: {
      type: String,
      enum: ["submitted", "accepted"],
      default: "submitted",
    },

    supersedesDeliveryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Delivery",
      default: null,
    },

    acceptedAt: {
      type: Date,
      default: null,
    },

    replacedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

deliverySchema.index({ orderId: 1, version: 1 }, { unique: true });
deliverySchema.index({ orderId: 1, revisionNumber: 1 });

const Delivery = mongoose.model("Delivery", deliverySchema);

export default Delivery;

