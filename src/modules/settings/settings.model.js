import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "marketplace",
      index: true,
    },
    platformName: {
      type: String,
      default: "Autobots Marketplace",
      trim: true,
    },
    marketplaceName: {
      type: String,
      default: "Autobots Marketplace",
      trim: true,
    },
    supportEmail: {
      type: String,
      default: "support@autobots.ai",
      trim: true,
    },
    contactEmail: {
      type: String,
      default: "contact@autobots.ai",
      trim: true,
    },
    commissionPercentage: {
      type: Number,
      default: 15,
      min: 0,
      max: 100,
    },
    defaultCurrency: {
      type: String,
      default: "USD",
      trim: true,
    },
    defaultTimezone: {
      type: String,
      default: "UTC",
      trim: true,
    },
    defaultListingStatus: {
      type: String,
      default: "approved",
      trim: true,
    },
    refundPolicy: {
      type: String,
      default: "Refunds are available within 7 days of purchase if the system does not meet described outcomes.",
      trim: true,
    },
    termsUrl: {
      type: String,
      default: "https://autobots.ai/terms",
      trim: true,
    },
    privacyUrl: {
      type: String,
      default: "https://autobots.ai/privacy",
      trim: true,
    },
  },
  { timestamps: true }
);

const Settings = mongoose.model("Settings", settingsSchema);

export default Settings;
