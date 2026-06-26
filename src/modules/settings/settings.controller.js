import { successResponse, errorResponse } from "../../utils/ApiResponse.js";
import * as settingsService from "./settings.service.js";
import { settingsSchema } from "./settings.validation.js";

export const getSettingsController = async (req, res) => {
  try {
    const settings = await settingsService.getSettings();
    return successResponse(res, "Settings fetched successfully", settings);
  } catch (err) {
    return errorResponse(res, err.message || "Failed to fetch settings", 400);
  }
};

export const updateSettingsController = async (req, res) => {
  try {
    const parsed = settingsSchema.parse(req.body);
    const settings = await settingsService.updateSettings(parsed);
    return successResponse(res, "Settings updated successfully", settings, 200);
  } catch (err) {
    const message = err?.issues?.[0]?.message || err.message || "Failed to update settings";
    return errorResponse(res, message, 400);
  }
};
