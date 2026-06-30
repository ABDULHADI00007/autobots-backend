import { successResponse, errorResponse } from "../../utils/ApiResponse.js";
import { checkoutSchema, requestCancellationSchema, adminCancellationSchema } from "./order.validation.js";
import * as orderService from "./order.service.js";

export const createCheckoutSession = async (req, res) => {
  try {
    const data = checkoutSchema.parse(req.body);
    const result = await orderService.createCheckoutSession(req.user.userId, data);
    return res.status(200).json({ success: true, checkoutUrl: result.checkoutUrl });
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    return errorResponse(res, err.message, 400);
  }
};

export const stripeWebhook = async (req, res) => {
  const signature = req.headers["stripe-signature"];
  console.log("[orders:webhook] endpoint reached", {
    path: req.path,
    method: req.method,
    hasSignature: Boolean(signature),
    contentType: req.headers["content-type"],
    bodyType: Buffer.isBuffer(req.body) ? "buffer" : typeof req.body,
  });

  try {
    const result = await orderService.handleWebhook(req.body, signature);
    console.log("[orders:webhook] handler result", result);
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("[orders:webhook] request failed", err?.message || err, err?.stack || "");
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const getBuyerOrders = async (req, res) => {
  try {
    const orders = await orderService.getBuyerOrders(req.user.userId);
    return successResponse(res, "Orders fetched successfully", orders);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const getSellerOrders = async (req, res) => {
  try {
    const orders = await orderService.getSellerOrders(req.user.userId);
    return successResponse(res, "Orders fetched successfully", orders);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const getAllOrders = async (req, res) => {
  try {
    const { page, limit, search, status, sortBy, sortOrder } = req.query;
    const result = await orderService.getAllOrders({ page, limit, search, status, sortBy, sortOrder });
    return successResponse(res, "All orders fetched successfully", result);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const getAdminOrderById = async (req, res) => {
  try {
    const order = await orderService.getAdminOrderById(req.params.id);
    return successResponse(res, "Order fetched successfully", order);
  } catch (err) {
    const status = err.message === "Order not found" ? 404 : 400;
    return errorResponse(res, err.message, status);
  }
};

export const acceptOrder = async (req, res) => {
  try {
    const order = await orderService.acceptOrder(req.params.id, req.user.userId);
    return successResponse(res, "Order accepted", order);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const completeOrder = async (req, res) => {
  try {
    const order = await orderService.approveDelivery(req.params.id, req.user.userId);
    return successResponse(res, "Order marked completed and funds released", order);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const cancelOrder = async (req, res) => {
  try {
    const order = await orderService.cancelOrder(req.params.id, req.user.userId);
    return successResponse(res, "Order cancelled", order);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const deliverOrder = async (req, res) => {
  try {
    const { deliveryNotes } = req.body || {};
    const order = await orderService.deliverOrder(req.params.id, req.user.userId, deliveryNotes);
    return successResponse(res, "Order delivered", order);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const approveDelivery = async (req, res) => {
  try {
    const order = await orderService.approveDelivery(req.params.id, req.user.userId);
    return successResponse(res, "Delivery approved and funds released", order);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const requestRevision = async (req, res) => {
  try {
    const { message } = req.body || {};
    const order = await orderService.requestRevision(req.params.id, req.user.userId, message);
    return successResponse(res, "Revision requested", order);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const requestCancellation = async (req, res) => {
  try {
    const data = requestCancellationSchema.parse(req.body || {});
    const order = await orderService.requestCancellation(req.params.id, req.user.userId, data);
    return successResponse(res, "Cancellation request submitted", order);
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    return errorResponse(res, err.message, 400);
  }
};

export const approveCancellation = async (req, res) => {
  try {
    const { adminNotes } = adminCancellationSchema.parse(req.body || {});
    const order = await orderService.approveCancellation(req.params.id, req.user.userId, adminNotes);
    return successResponse(res, "Cancellation approved", order);
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    return errorResponse(res, err.message, 400);
  }
};

export const rejectCancellation = async (req, res) => {
  try {
    const { adminNotes } = adminCancellationSchema.parse(req.body || {});
    const order = await orderService.rejectCancellation(req.params.id, req.user.userId, adminNotes);
    return successResponse(res, "Cancellation rejected", order);
  } catch (err) {
    if (err.name === "ZodError") return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    return errorResponse(res, err.message, 400);
  }
};

// Admin manual overrides
export const adminReleaseFunds = async (req, res) => {
  try {
    const order = await orderService.adminReleaseFunds(req.params.id);
    return successResponse(res, "Funds released by admin", order);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const adminRefundFunds = async (req, res) => {
  try {
    const order = await orderService.adminRefundFunds(req.params.id);
    return successResponse(res, "Funds refunded by admin", order);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};
