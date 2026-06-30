import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Listing",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ["held", "released", "refunded"],
      default: "held",
    },
    stripeSessionId: {
      type: String,
      default: "",
    },
    stripePaymentIntentId: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "delivered", "revision_requested", "completed", "cancelled", "disputed"],
      default: "pending",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    cancellationRequested: {
      type: Boolean,
      default: false,
    },
    cancellationReason: {
      type: String,
      trim: true,
      default: "",
    },
    cancellationNotes: {
      type: String,
      trim: true,
      default: "",
    },
    cancellationRequestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    cancellationRequestedAt: {
      type: Date,
    },
    cancellationDecision: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    cancellationDecisionAt: {
      type: Date,
    },
    cancellationAdminNotes: {
      type: String,
      trim: true,
      default: "",
    },
    // Escrow flow fields
    deliveredAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    reviewDeadline: {
      type: Date,
    },
    disputeOpenedAt: {
      type: Date,
    },
    adminDecisionAt: {
      type: Date,
    },
    deliveryNotes: {
      type: String,
      trim: true,
      default: "",
    },
    maxRevisions: {
      type: Number,
      default: 3,
    },
    revisionCount: {
      type: Number,
      default: 0,
    },
    revisionHistory: [
      {
        revisionNumber: {
          type: Number,
        },
        requestedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        message: {
          type: String,
          trim: true,
          default: "",
        },
        status: {
          type: String,
          enum: ["requested", "resolved"],
          default: "requested",
        },
        requestedAt: {
          type: Date,
        },
        resolvedAt: {
          type: Date,
        },
        sellerResponse: {
          type: String,
          trim: true,
          default: "",
        },
        deliveryNotes: {
          type: String,
          trim: true,
          default: "",
        },
      },
    ],
  },
  { timestamps: true }
);

orderSchema.index(
  { stripeSessionId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      stripeSessionId: { $type: "string", $ne: "" },
    },
  }
);

orderSchema.index(
  { stripePaymentIntentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      stripePaymentIntentId: { $type: "string", $ne: "" },
    },
  }
);

const Order = mongoose.model("Order", orderSchema);

export default Order;
