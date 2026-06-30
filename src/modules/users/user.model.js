import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    role: {
      type: String,
      enum: ["buyer", "seller", "admin"],
      default: "buyer",
    },
    verifiedSeller: {
      type: Boolean,
      default: false,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    verificationNotes: {
      type: String,
      trim: true,
      default: "",
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
    emailVerificationToken: {
      type: String,
      default: null,
    },
    emailVerificationExpires: {
      type: Date,
      default: null,
    },
    passwordResetToken: {
      type: String,
      default: null,
    },
    passwordResetExpires: {
      type: Date,
      default: null,
    },
    // ── User Avatar (S3) ──────────────────────────────────────────
    avatarKey: {
      type: String,
      default: null,
      trim: true,
    },
    avatarUrl: {
      type: String,
      default: null,
      trim: true,
    },
    // ── Seller Logo (S3) ─────────────────────────────────────────
    sellerLogoKey: {
      type: String,
      default: null,
      trim: true,
    },
    sellerLogoUrl: {
      type: String,
      default: null,
      trim: true,
    },
    // ── Seller Banner (S3) ───────────────────────────────────────
    sellerBannerKey: {
      type: String,
      default: null,
      trim: true,
    },
    sellerBannerUrl: {
      type: String,
      default: null,
      trim: true,
    },
    isSuspended: {
      type: Boolean,
      default: false,
    },
    suspendedAt: {
      type: Date,
      default: null,
    },
    suspendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    suspensionReason: {
      type: String,
      trim: true,
      default: "",
    },
    adminNotes: [
      {
        note: {
          type: String,
          trim: true,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        authorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      },
    ],
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
