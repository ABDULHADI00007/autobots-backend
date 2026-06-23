import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import roleMiddleware from "../../middleware/role.middleware.js";
import {
  createEvidenceController,
  listEvidenceController,
  getEvidenceController,
  verifyEvidenceController,
  requestEvidenceController,
  deleteEvidenceController,
} from "./evidence.controller.js";

// ── Dispute-scoped evidence routes (/disputes/:disputeId/evidence) ─────────────
// Mounted at /disputes in the main router
export const disputeEvidenceRouter = Router({ mergeParams: true });

// Buyer, seller, and admin can list and submit evidence for their dispute
disputeEvidenceRouter.get(
  "/",
  authMiddleware,
  roleMiddleware("buyer", "seller", "admin"),
  listEvidenceController
);

disputeEvidenceRouter.post(
  "/",
  authMiddleware,
  roleMiddleware("buyer", "seller", "admin"),
  createEvidenceController
);

// Admin-only: request evidence from a participant
disputeEvidenceRouter.post(
  "/request",
  authMiddleware,
  roleMiddleware("admin"),
  requestEvidenceController
);

// ── Standalone evidence routes (/evidence/:id) ─────────────────────────────────
// Mounted at /evidence in the main router
export const evidenceRouter = Router();

evidenceRouter.get(
  "/:id",
  authMiddleware,
  roleMiddleware("buyer", "seller", "admin"),
  getEvidenceController
);

// Admin-only: mark evidence as verified
evidenceRouter.post(
  "/:id/verify",
  authMiddleware,
  roleMiddleware("admin"),
  verifyEvidenceController
);

evidenceRouter.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("buyer", "seller", "admin"),
  deleteEvidenceController
);
