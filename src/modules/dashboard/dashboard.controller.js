import { successResponse, errorResponse } from "../../utils/ApiResponse.js";
import * as dashboardService from "./dashboard.service.js";

export const getOverview = async (req, res) => {
  try {
    const data = await dashboardService.getOverview();
    return successResponse(res, "Overview fetched successfully", data);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const getRevenue = async (req, res) => {
  try {
    const data = await dashboardService.getRevenue();
    return successResponse(res, "Revenue fetched successfully", data);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const getOrderStats = async (req, res) => {
  try {
    const data = await dashboardService.getOrderStats();
    return successResponse(res, "Order stats fetched successfully", data);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const getListingStats = async (req, res) => {
  try {
    const data = await dashboardService.getListingStats();
    return successResponse(res, "Listing stats fetched successfully", data);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const getUserStats = async (req, res) => {
  try {
    const data = await dashboardService.getUserStats();
    return successResponse(res, "User stats fetched successfully", data);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const getRefundStats = async (req, res) => {
  try {
    const data = await dashboardService.getRefundStats();
    return successResponse(res, "Refund stats fetched successfully", data);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const getReviewStats = async (req, res) => {
  try {
    const data = await dashboardService.getReviewStats();
    return successResponse(res, "Review stats fetched successfully", data);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const getAnalytics = async (req, res) => {
  try {
    const data = await dashboardService.getAnalytics({
      range: req.query.range,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });
    return successResponse(res, "Analytics fetched successfully", data);
  } catch (err) {
    return errorResponse(res, err.message || "Failed to fetch analytics");
  }
};
