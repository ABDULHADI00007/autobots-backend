import { profileUpdateSchema, buyerAdminNoteSchema, buyerSuspendSchema } from "./user.validation.js";
import {
  getProfile,
  updateProfile,
  updateRole,
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
    const buyers = await getAdminBuyers();
    return successResponse(res, "Buyers fetched successfully", buyers, 200);
  } catch (error) {
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
