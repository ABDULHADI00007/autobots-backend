import * as NotificationService from "./notification.service.js";
import { successResponse, errorResponse } from "../../utils/ApiResponse.js";

export const listNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const role = req.user.role;
    const { page = 1, limit = 50 } = req.validated?.query ?? {};

    const data = await NotificationService.getNotifications(userId, { page, limit }, role);
    return successResponse(res, "Notifications retrieved", data);
  } catch (err) {
    console.error(err);
    return errorResponse(res, "Failed to fetch notifications");
  }
};

export const unreadCount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const role = req.user.role;
    const count = await NotificationService.getUnreadCount(userId, role);
    return successResponse(res, "Unread count", { count });
  } catch (err) {
    console.error(err);
    return errorResponse(res, "Failed to fetch unread count");
  }
};

export const markRead = async (req, res) => {
  try {
    const userId = req.user.userId;
    const role = req.user.role;
    const { id } = req.validated?.params ?? req.params;
    const doc = await NotificationService.markAsRead(id, userId, role);
    if (!doc) return errorResponse(res, "Notification not found", 404);
    return successResponse(res, "Notification marked read", doc);
  } catch (err) {
    console.error(err);
    return errorResponse(res, "Failed to mark notification read");
  }
};

export const markReadByReference = async (req, res) => {
  try {
    const userId = req.user.userId;
    const role = req.user.role;
    const { referenceType, referenceId } = req.validated?.query ?? req.query;
    const count = await NotificationService.markAsReadByReference(referenceType, referenceId, userId, role);
    return successResponse(res, "Notifications marked read", { count });
  } catch (err) {
    console.error(err);
    return errorResponse(res, "Failed to mark notifications read by reference");
  }
};

export const markAll = async (req, res) => {
  try {
    const userId = req.user.userId;
    const role = req.user.role;
    await NotificationService.markAllAsRead(userId, role);
    return successResponse(res, "All notifications marked read", null);
  } catch (err) {
    console.error(err);
    return errorResponse(res, "Failed to mark all notifications read");
  }
};

export const remove = async (req, res) => {
  try {
    const userId = req.user.userId;
    const role = req.user.role;
    const { id } = req.validated?.params ?? req.params;
    const doc = await NotificationService.removeNotification(id, userId, role);
    if (!doc) return errorResponse(res, "Notification not found", 404);
    return successResponse(res, "Notification deleted", null);
  } catch (err) {
    console.error(err);
    return errorResponse(res, "Failed to delete notification");
  }
};
