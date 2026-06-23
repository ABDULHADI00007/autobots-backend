import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import { getOrderTimelineController, getDisputeTimelineController } from "./timeline.controller.js";

const orderTimelineRouter  = Router({ mergeParams: true });
const disputeTimelineRouter = Router({ mergeParams: true });

orderTimelineRouter.get("/",  authMiddleware, getOrderTimelineController);
disputeTimelineRouter.get("/", authMiddleware, getDisputeTimelineController);

export { orderTimelineRouter, disputeTimelineRouter };
