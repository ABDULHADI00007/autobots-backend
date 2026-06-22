import { successResponse, errorResponse } from "../../utils/ApiResponse.js";
import { z } from "zod";
import * as deliveryService from "./delivery.service.js";

const createDeliverySchema = z.object({
  summaryNotes: z.string().optional().default(""),
  links: z.array(z.string().url()).optional().default([]),
});

export const getOrderDeliveriesController = async (req, res) => {
  try {
    const payload = await deliveryService.getOrderDeliveries({
      orderId: req.params.orderId,
      userId: req.user.userId,
      role: req.user.role,
    });
    return successResponse(res, "Deliveries fetched", payload);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

export const createOrderDeliveryController = async (req, res) => {
  try {
    const body = createDeliverySchema.parse(req.body || {});
    const payload = await deliveryService.createOrderDelivery({
      orderId: req.params.orderId,
      submittedBy: req.user.userId,
      role: req.user.role,
      summaryNotes: body.summaryNotes,
      links: body.links,
    });

    return successResponse(res, "Delivery submitted", payload, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(res, err.issues[0]?.message || "Validation failed", 400);
    }
    return errorResponse(res, err.message, 400);
  }
};

export const getDeliveryController = async (req, res) => {
  try {
    const payload = await deliveryService.getDelivery({
      deliveryId: req.params.deliveryId,
      userId: req.user.userId,
      role: req.user.role,
    });

    return successResponse(res, "Delivery fetched", payload);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

