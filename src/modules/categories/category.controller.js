import { successResponse, errorResponse } from "../../utils/ApiResponse.js";
import * as categoryService from "./category.service.js";

export const getAllCategories = async (req, res) => {
  try {
    const categories = await categoryService.getAllCategories();
    return successResponse(res, "Categories fetched successfully", categories);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const getCategoryBySlug = async (req, res) => {
  try {
    const category = await categoryService.getCategoryBySlug(req.params.slug);
    return successResponse(res, "Category fetched successfully", category);
  } catch (err) {
    return errorResponse(res, err.message, 404);
  }
};
