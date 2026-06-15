import { registerSchema, loginSchema } from "./auth.validation.js";
import { registerUser, loginUser, getCurrentUser } from "./auth.service.js";
import { successResponse, errorResponse } from "../../utils/ApiResponse.js";

export const register = async (req, res) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const result = await registerUser(validatedData);

    return successResponse(res, "User registered successfully", result, 201);
  } catch (error) {
    if (error.name === "ZodError") {
      return errorResponse(res, error.issues[0]?.message || "Validation failed", 400);
    }

    return errorResponse(res, error.message || "Registration failed", 400);
  }
};

export const login = async (req, res) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const result = await loginUser(validatedData);

    return successResponse(res, "Login successful", result, 200);
  } catch (error) {
    if (error.name === "ZodError") {
      return errorResponse(res, error.issues[0]?.message || "Validation failed", 400);
    }

    return errorResponse(res, error.message || "Login failed", 401);
  }
};

export const me = async (req, res) => {
  try {
    const user = await getCurrentUser(req.user.userId);

    return successResponse(res, "User profile fetched successfully", user, 200);
  } catch (error) {
    return errorResponse(res, error.message || "Failed to fetch user profile", 404);
  }
};
