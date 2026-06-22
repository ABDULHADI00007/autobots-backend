import { successResponse, errorResponse } from "../../utils/ApiResponse.js";
import { checkoutSchema } from "./order.validation.js";
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
  console.log("[orders:webhook] request received", {
    hasSignature: Boolean(signature),
    contentType: req.headers["content-type"],
    bodyType: Buffer.isBuffer(req.body) ? "buffer" : typeof req.body,
  });

  try {
    await orderService.handleWebhook(req.body, signature);
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
    const orders = await orderService.getAllOrders();
    return successResponse(res, "All orders fetched successfully", orders);
  } catch (err) {
    return errorResponse(res, err.message);
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
