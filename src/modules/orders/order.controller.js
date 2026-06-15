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
  try {
    await orderService.handleWebhook(req.body, signature);
    return res.status(200).json({ received: true });
  } catch (err) {
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
    const order = await orderService.completeOrder(req.params.id, req.user.userId);
    return successResponse(res, "Order completed", order);
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
