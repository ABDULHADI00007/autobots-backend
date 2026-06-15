import SellerApplication from "./sellerApplication.model.js";
import User from "../users/user.model.js";

export const createApplication = async (userId, data) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  if (user.role !== "seller") throw new Error("Only seller users can apply");

  const existing = await SellerApplication.findOne({ userId });
  if (existing) {
    if (existing.status === "approved") {
      throw new Error("Approved seller cannot submit another application");
    }
    if (existing.status === "pending") {
      throw new Error("Your application is already under review");
    }
    if (existing.status === "rejected") {
      if (existing.attemptCount >= 3) {
        throw new Error("You have used all 3 attempts. No more applications allowed");
      }
      existing.status = "pending";
      existing.attemptCount += 1;
      existing.adminNotes = "";
      Object.assign(existing, data);
      return existing.save();
    }
  }

  const application = await SellerApplication.create({
    userId,
    ...data,
    status: "pending",
    attemptCount: 1,
  });

  return application;
};

export const getMyApplication = async (userId) => {
  return SellerApplication.findOne({ userId }).populate("userId", "name email role");
};

export const getAllApplications = async () => {
  return SellerApplication.find().populate("userId", "name email role");
};

export const approveApplication = async (applicationId, adminNotes = "") => {
  const application = await SellerApplication.findById(applicationId);
  if (!application) throw new Error("Application not found");

  application.status = "approved";
  application.adminNotes = adminNotes;
  await application.save();

  await User.findByIdAndUpdate(application.userId, { role: "seller" });

  return application;
};

export const rejectApplication = async (applicationId, adminNotes = "") => {
  const application = await SellerApplication.findById(applicationId);
  if (!application) throw new Error("Application not found");

  application.status = "rejected";
  application.adminNotes = adminNotes;
  await application.save();

  return application;
};
