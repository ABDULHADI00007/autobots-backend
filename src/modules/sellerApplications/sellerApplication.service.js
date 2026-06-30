import SellerApplication from "./sellerApplication.model.js";
import User from "../users/user.model.js";
import {
  sendSellerApplicationSubmittedEmailApplicant,
  sendNewSellerApplicationAdminEmail,
  sendSellerApplicationApprovedEmailApplicant,
  sendSellerApplicationRejectedEmailApplicant,
  sendSellerApplicationResubmittedAdminEmail,
} from "../email/marketplace.email.js";
import { storage, STORAGE_FOLDERS } from "../../config/storage/index.js";

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
      const resubmitted = await existing.save();
      // Notify admin about resubmitted seller application
      try {
        const NotificationService = await import("../notifications/notification.service.js");
        await NotificationService.createNotification({
          userId: null,
          broadcastAdmin: true,
          type: "seller_application",
          title: "Seller application resubmitted",
          message: `A seller application was resubmitted by user ${userId}`,
          referenceType: "seller_application",
          referenceId: resubmitted._id,
        });
      } catch (e) {
        console.error("notify:resubmitApplication:admin", e?.message || e);
      }

      try {
        await Promise.allSettled([
          sendSellerApplicationSubmittedEmailApplicant({
            applicant: user,
            application: resubmitted,
          }),
          sendSellerApplicationResubmittedAdminEmail({
            applicantName: user.name || user.email || "Applicant",
            application: resubmitted,
          }),
        ]);
      } catch (e) {
        console.error("email:resubmitApplication", e?.message || e);
      }

      return resubmitted;
    }
  }

  const application = await SellerApplication.create({
    userId,
    ...data,
    status: "pending",
    attemptCount: 1,
  });

  // Notify admins about new seller application
  try {
    const NotificationService = await import("../notifications/notification.service.js");
    try {
      await NotificationService.createNotification({
        userId: null,
        broadcastAdmin: true,
        type: "seller_application",
        title: "New seller application",
        message: `A new seller application was submitted by user ${userId}`,
        referenceType: "seller_application",
        referenceId: application._id,
      });
    } catch (e) { console.error("notify:createApplication:admin", e?.message || e); }
  } catch (e) { console.error("notify:createApplication", e?.message || e); }

  try {
    await Promise.allSettled([
      sendSellerApplicationSubmittedEmailApplicant({
        applicant: user,
        application,
      }),
      sendNewSellerApplicationAdminEmail({
        applicantName: user.name || user.email || "Applicant",
        application,
      }),
    ]);
  } catch (e) {
    console.error("email:createApplication", e?.message || e);
  }

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

  // Notify applicant that their application was approved
  try {
    const NotificationService = await import("../notifications/notification.service.js");
    try {
      await NotificationService.createNotification({
        userId: application.userId,
        type: "seller_application",
        title: "Seller application approved",
        message: `Your seller application has been approved`,
        referenceType: "seller_application",
        referenceId: application._id,
      });
    } catch (e) { console.error("notify:approveApplication:user", e?.message || e); }
  } catch (e) { console.error("notify:approveApplication", e?.message || e); }

  try {
    const applicant = await User.findById(application.userId).select("name email");
    if (applicant?.email) {
      await sendSellerApplicationApprovedEmailApplicant({ applicant });
    }
  } catch (e) {
    console.error("email:approveApplication", e?.message || e);
  }

  return application;
};

export const rejectApplication = async (applicationId, adminNotes = "") => {
  const application = await SellerApplication.findById(applicationId);
  if (!application) throw new Error("Application not found");

  application.status = "rejected";
  application.adminNotes = adminNotes;
  await application.save();

  // Notify applicant that their application was rejected
  try {
    const NotificationService = await import("../notifications/notification.service.js");
    try {
      await NotificationService.createNotification({
        userId: application.userId,
        type: "seller_application",
        title: "Seller application rejected",
        message: `Your seller application has been rejected`,
        referenceType: "seller_application",
        referenceId: application._id,
      });
    } catch (e) { console.error("notify:rejectApplication:user", e?.message || e); }
  } catch (e) { console.error("notify:rejectApplication", e?.message || e); }

  try {
    const applicant = await User.findById(application.userId).select("name email");
    if (applicant?.email) {
      await sendSellerApplicationRejectedEmailApplicant({
        applicant,
        reason: adminNotes,
        application,
      });
    }
  } catch (e) {
    console.error("email:rejectApplication", e?.message || e);
  }

  return application;
};

// ============================================================
// DOCUMENT UPLOADS — IDENTITY DOCUMENT
// ============================================================

/**
 * Asserts the application belongs to the given user.
 */
async function getApplicationOwnedByUser(userId) {
  const application = await SellerApplication.findOne({ userId });
  if (!application) throw new Error("Seller application not found");
  return application;
}

/**
 * Uploads or replaces an identity document (CNIC/Passport/National ID).
 * Transaction-safe: new S3 object deleted if DB update fails.
 *
 * @param {string} userId
 * @param {{ buffer: Buffer, mimeType: string, fileName: string, sizeBytes: number, docType: string }} file
 * @returns {Promise<object>} Updated application
 */
export const uploadIdentityDocument = async (userId, { buffer, mimeType, fileName, sizeBytes, docType }) => {
  const application = await getApplicationOwnedByUser(userId);
  const previousKey = application.identityDocKey || null;

  await storage.replace({
    folder:      STORAGE_FOLDERS.SELLER_APPLICATIONS,
    body:        buffer,
    mimeType,
    fileName,
    sizeBytes,
    previousKey,
    constraints: {
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
      maxBytes: 10 * 1024 * 1024,
    },
    dbUpdateFn: async (result) => {
      await SellerApplication.findByIdAndUpdate(application._id, {
        identityDocKey:  result.key,
        identityDocUrl:  result.url,
        identityDocType: docType,
      });
    },
  });

  return SellerApplication.findById(application._id);
};

/**
 * Removes the identity document from S3 and clears the DB fields.
 *
 * @param {string} userId
 * @returns {Promise<object>} Updated application
 */
export const removeIdentityDocument = async (userId) => {
  const application = await getApplicationOwnedByUser(userId);
  if (!application.identityDocKey) throw new Error("No identity document to remove");

  await SellerApplication.findByIdAndUpdate(application._id, {
    identityDocKey:  null,
    identityDocUrl:  null,
    identityDocType: null,
  });

  try {
    await storage.delete.one(application.identityDocKey);
  } catch (err) {
    console.warn(`[STORAGE] Identity doc cleanup failed for application ${application._id}: ${err.message}`);
  }

  return SellerApplication.findById(application._id);
};

// ============================================================
// DOCUMENT UPLOADS — PORTFOLIO FILE
// ============================================================

/**
 * Uploads or replaces a portfolio file.
 *
 * @param {string} userId
 * @param {{ buffer: Buffer, mimeType: string, fileName: string, sizeBytes: number }} file
 * @returns {Promise<object>} Updated application
 */
export const uploadPortfolioFile = async (userId, { buffer, mimeType, fileName, sizeBytes }) => {
  const application = await getApplicationOwnedByUser(userId);
  const previousKey = application.portfolioFileKey || null;

  await storage.replace({
    folder:      STORAGE_FOLDERS.SELLER_APPLICATIONS,
    body:        buffer,
    mimeType,
    fileName,
    sizeBytes,
    previousKey,
    constraints: {
      allowedMimeTypes: [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/zip",
        "application/x-zip-compressed",
      ],
      maxBytes: 25 * 1024 * 1024,
    },
    dbUpdateFn: async (result) => {
      await SellerApplication.findByIdAndUpdate(application._id, {
        portfolioFileKey: result.key,
        portfolioFileUrl: result.url,
      });
    },
  });

  return SellerApplication.findById(application._id);
};

/**
 * Removes the portfolio file from S3 and clears the DB fields.
 *
 * @param {string} userId
 * @returns {Promise<object>} Updated application
 */
export const removePortfolioFile = async (userId) => {
  const application = await getApplicationOwnedByUser(userId);
  if (!application.portfolioFileKey) throw new Error("No portfolio file to remove");

  await SellerApplication.findByIdAndUpdate(application._id, {
    portfolioFileKey: null,
    portfolioFileUrl: null,
  });

  try {
    await storage.delete.one(application.portfolioFileKey);
  } catch (err) {
    console.warn(`[STORAGE] Portfolio file cleanup failed for application ${application._id}: ${err.message}`);
  }

  return SellerApplication.findById(application._id);
};

// ============================================================
// DOCUMENT UPLOADS — SUPPORTING DOCUMENTS
// ============================================================

/**
 * Adds a supporting document to the application (max 5).
 * Transaction-safe: S3 object removed if DB update fails.
 *
 * @param {string} userId
 * @param {{ buffer: Buffer, mimeType: string, fileName: string, sizeBytes: number, label: string }} file
 * @returns {Promise<object>} Updated application
 */
export const addSupportingDocument = async (userId, { buffer, mimeType, fileName, sizeBytes, label }) => {
  const application = await getApplicationOwnedByUser(userId);

  const currentCount = (application.supportingDocKeys || []).length;
  if (currentCount >= 5) {
    throw new Error("Maximum 5 supporting documents allowed.");
  }

  const uploadResult = await storage.upload.buffer({
    folder:      STORAGE_FOLDERS.SELLER_APPLICATIONS,
    buffer,
    mimeType,
    fileName,
    constraints: {
      allowedMimeTypes: [
        "image/jpeg", "image/png", "image/webp",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
      maxBytes: 25 * 1024 * 1024,
    },
  });

  return storage.withTransactionSafety(uploadResult, async () => {
    await SellerApplication.findByIdAndUpdate(application._id, {
      $push: {
        supportingDocKeys:   uploadResult.key,
        supportingDocUrls:   uploadResult.url,
        supportingDocLabels: label,
      },
    });
  }).then(() => SellerApplication.findById(application._id));
};

/**
 * Removes one supporting document by its S3 key.
 * DB updated first, S3 deletion is best-effort.
 *
 * @param {string} userId
 * @param {string} docKey - The S3 key of the document to remove
 * @returns {Promise<object>} Updated application
 */
export const removeSupportingDocument = async (userId, docKey) => {
  const application = await getApplicationOwnedByUser(userId);

  const keyIndex = (application.supportingDocKeys || []).indexOf(docKey);
  if (keyIndex === -1) throw new Error("Document not found in supporting documents");

  const newKeys   = application.supportingDocKeys.filter((_, i) => i !== keyIndex);
  const newUrls   = application.supportingDocUrls.filter((_, i) => i !== keyIndex);
  const newLabels = application.supportingDocLabels.filter((_, i) => i !== keyIndex);

  await SellerApplication.findByIdAndUpdate(application._id, {
    supportingDocKeys:   newKeys,
    supportingDocUrls:   newUrls,
    supportingDocLabels: newLabels,
  });

  try {
    await storage.delete.one(docKey);
  } catch (err) {
    console.warn(`[STORAGE] Supporting doc cleanup failed for application ${application._id}, key ${docKey}: ${err.message}`);
  }

  return SellerApplication.findById(application._id);
};
