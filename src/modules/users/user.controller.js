import { profileUpdateSchema, roleUpdateSchema } from "./user.validation.js";
import { getProfile, updateProfile, updateRole } from "./user.service.js";
import { successResponse, errorResponse } from "../../utils/ApiResponse.js";

export const getProfileController = async (req, res) => {
  try {
    const user = await getProfile(req.user.userId);
    return successResponse(res, "Profile fetched successfully", user, 200);
  } catch (error) {
    return errorResponse(res, error.message || "Failed to fetch profile", 404);
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

export const updateRoleController = async (req, res) => {
  try {
    const validatedData = roleUpdateSchema.parse(req.body);
    const user = await updateRole(req.user.userId, validatedData.role);
    return successResponse(res, "Role updated successfully", user, 200);
  } catch (error) {
    if (error.name === "ZodError") {
      return errorResponse(res, error.issues[0]?.message || "Validation failed", 400);
    }

    return errorResponse(res, error.message || "Failed to update role", 400);
  }
};
