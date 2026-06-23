import { successResponse, errorResponse } from "../../utils/ApiResponse.js";
import * as timelineService from "./timeline.service.js";

export const getOrderTimelineController = async (req, res) => {
  try {
    const data = await timelineService.getOrderTimeline(req.params.orderId, req.user.userId, req.user.role, req.query);
    return successResponse(res, "Order timeline fetched", data);
  } catch (err) {
    return errorResponse(res, err.message, err.message === "Access denied" ? 403 : 400);
  }
};

export const getDisputeTimelineController = async (req, res) => {
  try {
    const data = await timelineService.getDisputeTimeline(req.params.disputeId, req.user.userId, req.user.role, req.query);
    return successResponse(res, "Dispute timeline fetched", data);
  } catch (err) {
    return errorResponse(res, err.message, err.message === "Access denied" ? 403 : 400);
  }
};
