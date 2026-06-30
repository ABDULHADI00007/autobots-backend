import { profileUpdateSchema, avatarUploadSchema, logoUploadSchema, bannerUploadSchema, buyerAdminNoteSchema, buyerSuspendSchema, buyerAdminListSchema } from "./user.validation.js";
import {
  getProfile,
  updateProfile,
  updateRole,
  updateAvatar,
  deleteAvatar,
  updateSellerLogo,
  deleteSellerLogo,
  updateSellerBanner,
  deleteSellerBanner,
  getAdminUsers,
  getAdminSellers,
  getAdminSellerById,
  getAdminBuyers,
  getAdminBuyerById,
  suspendBuyer,
  unsuspendBuyer,
  createBuyerAdminNote,
  verifySeller,
  unverifySeller,
} from "./user.service.js";
import { successResponse, errorResponse } from "../../utils/ApiResponse.js";

export const getProfileController = async (req, res) => {
  try {
    const user = await getProfile(req.user.userId);
    return successResponse(res, "Profile fetched successfully", user, 200);
  } catch (error) {
    return errorResponse(res, error.message || "Failed to fetch profile", 404);
  }
};

export const updateRoleController = async (req, res) => {
  try {
    const { role } = req.body;
    if (!role) return errorResponse(res, "role is required", 400);
    const user = await updateRole(req.user.userId, role);
    return successResponse(res, "Role updated", user);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const updateProfileController = async (req, res) => {
  try {
    const validatedData = profileUpdateSchema.parse(req.body);
    const user = await updateProfile(req.user.userId, validatedData);
    return successResponse(res, "Profile updated successfully", user, 200);
  } catch (error) {
    if (error.name === "ZodError") {
      return errorResponse(res, error.issues[0]?.message || "Validation failed", 400);
    }

    return errorResponse(res, error.message || "Failed to update profile", 400);
  }
};

export const getAdminUsersController = async (req, res) => {
  try {
    const admins = await getAdminUsers();
    return successResponse(res, "Admins fetched successfully", admins, 200);
  } catch (error) {
    return errorResponse(res, error.message || "Failed to fetch admins", 400);
  }
};

export const getAdminSellersController = async (req, res) => {
  try {
    const sellers = await getAdminSellers();
    return successResponse(res, "Sellers fetched successfully", sellers, 200);
  } catch (error) {
    return errorResponse(res, error.message || "Failed to fetch sellers", 400);
  }
};

export const getAdminSellerByIdController = async (req, res) => {
  try {
    const seller = await getAdminSellerById(req.params.userId);
    return successResponse(res, "Seller fetched successfully", seller, 200);
  } catch (error) {
    return errorResponse(res, error.message || "Seller not found", 404);
  }
};

export const getAdminBuyersController = async (req, res) => {
  try {
    const query = buyerAdminListSchema.parse(req.query);
    const buyers = await getAdminBuyers(query);
    return successResponse(res, "Buyers fetched successfully", buyers, 200);
  } catch (error) {
    if (error.name === "ZodError") {
      return errorResponse(res, error.issues[0]?.message || "Validation failed", 400);
    }
    return errorResponse(res, error.message || "Failed to fetch buyers", 400);
  }
};

export const getAdminBuyerByIdController = async (req, res) => {
  try {
    const buyer = await getAdminBuyerById(req.params.userId);
    return successResponse(res, "Buyer fetched successfully", buyer, 200);
  } catch (error) {
    return errorResponse(res, error.message || "Buyer not found", 404);
  }
};

export const suspendBuyerController = async (req, res) => {
  try {
    const data = buyerSuspendSchema.parse(req.body);
    const buyer = await suspendBuyer(req.params.userId, req.user.userId, data.reason);
    return successResponse(res, "Buyer suspended successfully", buyer, 200);
  } catch (error) {
    if (error.name === "ZodError") {
      return errorResponse(res, error.issues[0]?.message || "Validation failed", 400);
    }
    return errorResponse(res, error.message || "Failed to suspend buyer", 400);
  }
};

export const unsuspendBuyerController = async (req, res) => {
  try {
    const buyer = await unsuspendBuyer(req.params.userId);
    return successResponse(res, "Buyer unsuspended successfully", buyer, 200);
  } catch (error) {
    return errorResponse(res, error.message || "Failed to unsuspend buyer", 400);
  }
};

export const createBuyerAdminNoteController = async (req, res) => {
  try {
    const data = buyerAdminNoteSchema.parse(req.body);
    const note = await createBuyerAdminNote(req.params.userId, req.user.userId, data.note);
    return successResponse(res, "Admin note added successfully", note, 201);
  } catch (error) {
    if (error.name === "ZodError") {
      return errorResponse(res, error.issues[0]?.message || "Validation failed", 400);
    }
    return errorResponse(res, error.message || "Failed to add admin note", 400);
  }
};

export const verifySellerController = async (req, res) => {
  try {
    const seller = await verifySeller(req.params.userId, req.user.userId, req.body?.notes || "");
    return successResponse(res, "Seller verified successfully", seller, 200);
  } catch (error) {
    return errorResponse(res, error.message || "Failed to verify seller", 400);
  }
};

export const unverifySellerController = async (req, res) => {
  try {
    const seller = await unverifySeller(req.params.userId, req.body?.notes || "");
    return successResponse(res, "Seller verification removed", seller, 200);
  } catch (error) {
    return errorResponse(res, error.message || "Failed to update seller verification", 400);
  }
};

// ============================================================
// MEDIA UPLOAD CONTROLLERS
// Decode base64 content, delegate to service, return updated profile.
// All S3 work happens inside user.service.js via the Storage Engine.
// ============================================================

function decodeUploadBody(body, schema) {
  const parsed = schema.parse(body);
  const raw = parsed.contentBase64.includes(",")
    ? parsed.contentBase64.split(",").pop()
    : parsed.contentBase64;
  const buffer = Buffer.from(raw, "base64");
  return { buffer, mimeType: parsed.mimeType, fileName: parsed.fileName, sizeBytes: parsed.sizeBytes };
}

// ── Avatar ───────────────────────────────────────────────────

export const uploadAvatarController = async (req, res) => {
  try {
    const file = decodeUploadBody(req.body, avatarUploadSchema);
    const user = await updateAvatar(req.user.userId, file);
    return successResponse(res, "Avatar updated successfully", user, 200);
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    const code = err?.code || "";
    const status = code === "STORAGE_VALIDATION_ERROR" ? 400 : code === "STORAGE_CONFIG_ERROR" ? 503 : 400;
    return errorResponse(res, err.message || "Failed to upload avatar", status);
  }
};

export const removeAvatarController = async (req, res) => {
  try {
    const user = await deleteAvatar(req.user.userId);
    return successResponse(res, "Avatar removed successfully", user, 200);
  } catch (err) {
    return errorResponse(res, err.message || "Failed to remove avatar", 400);
  }
};

// ── Seller Logo ──────────────────────────────────────────

export const uploadLogoController = async (req, res) => {
  try {
    const file = decodeUploadBody(req.body, logoUploadSchema);
    const user = await updateSellerLogo(req.user.userId, file);
    return successResponse(res, "Logo updated successfully", user, 200);
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    const code = err?.code || "";
    const status = code === "STORAGE_VALIDATION_ERROR" ? 400 : code === "STORAGE_CONFIG_ERROR" ? 503 : 400;
    return errorResponse(res, err.message || "Failed to upload logo", status);
  }
};

export const removeLogoController = async (req, res) => {
  try {
    const user = await deleteSellerLogo(req.user.userId);
    return successResponse(res, "Logo removed successfully", user, 200);
  } catch (err) {
    return errorResponse(res, err.message || "Failed to remove logo", 400);
  }
};

// ── Seller Banner ───────────────────────────────────────

export const uploadBannerController = async (req, res) => {
  try {
    const file = decodeUploadBody(req.body, bannerUploadSchema);
    const user = await updateSellerBanner(req.user.userId, file);
    return successResponse(res, "Banner updated successfully", user, 200);
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    const code = err?.code || "";
    const status = code === "STORAGE_VALIDATION_ERROR" ? 400 : code === "STORAGE_CONFIG_ERROR" ? 503 : 400;
    return errorResponse(res, err.message || "Failed to upload banner", status);
  }
};

export const removeBannerController = async (req, res) => {
  try {
    const user = await deleteSellerBanner(req.user.userId);
    return successResponse(res, "Banner removed successfully", user, 200);
  } catch (err) {
    return errorResponse(res, err.message || "Failed to remove banner", 400);
  }
};
