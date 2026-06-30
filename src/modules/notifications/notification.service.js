import Notification from "./notification.model.js";
import { io } from "../../socket/index.js";

export const createNotification = async ({ userId, type, title, message, referenceType, referenceId, broadcastAdmin = false }) => {
  const doc = await Notification.create({ userId, type, title, message, referenceType, referenceId });

  try {
    if (doc.userId && io) {
      io.to(`user:${doc.userId}`).emit("notification:created", doc);
    }

    if (broadcastAdmin && io) {
      io.to("admin").emit("notification:created", doc);
    }
  } catch (err) {
    // avoid failing creation if socket emit fails
    console.error("notification emit error", err?.message || err);
  }

  return doc;
};

export const markAsRead = async (notificationId, userId, role) => {
  const filter = role === "admin"
    ? { _id: notificationId, $or: [{ userId }, { userId: null }] }
    : { _id: notificationId, userId };

  const doc = await Notification.findOneAndUpdate(
    filter,
    { read: true, readAt: new Date() },
    { new: true }
  );

  if (doc && io) {
    io.to(`user:${userId}`).emit("notification:read", { id: doc._id });
  }

  return doc;
};

export const markAsReadByReference = async (referenceType, referenceId, userId, role) => {
  const filter = role === "admin"
    ? { $or: [{ userId }, { userId: null }], referenceType, referenceId, read: false }
    : { userId, referenceType, referenceId, read: false };
  const unreadNotifications = await Notification.find(filter).select("_id").lean();
  if (unreadNotifications.length === 0) {
    return 0;
  }

  await Notification.updateMany(filter, { read: true, readAt: new Date() });

  if (io) {
    unreadNotifications.forEach((notification) => {
      io.to(`user:${userId}`).emit("notification:read", { id: notification._id });
    });
  }

  return unreadNotifications.length;
};

export const markAllAsRead = async (userId, role) => {
  const query = role === "admin"
    ? { $or: [{ userId }, { userId: null }], read: false }
    : { userId, read: false };
  await Notification.updateMany(query, { read: true, readAt: new Date() });

  if (io) {
    io.to(`user:${userId}`).emit("notification:read-all", {});
  }
};

export const getNotifications = async (userId, { page = 1, limit = 50 } = {}, role) => {
  const skip = (page - 1) * limit;
  const query = role === "admin"
    ? { $or: [{ userId }, { userId: null }] }
    : { userId };

  const items = await Notification.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await Notification.countDocuments(query);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const getUnreadCount = async (userId, role) => {
  const query = role === "admin"
    ? { $or: [{ userId }, { userId: null }], read: false }
    : { userId, read: false };
  return Notification.countDocuments(query);
};

export const removeNotification = async (notificationId, userId, role) => {
  const filter = role === "admin"
    ? { _id: notificationId, $or: [{ userId }, { userId: null }] }
    : { _id: notificationId, userId };
  return Notification.findOneAndDelete(filter);
};

export default {
  createNotification,
  markAsRead,
  markAllAsRead,
  getNotifications,
  getUnreadCount,
  removeNotification,
};
