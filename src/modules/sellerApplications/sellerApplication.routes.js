import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import roleMiddleware from "../../middleware/role.middleware.js";
import {
  createApplicationController,
  getMyApplicationController,
  getAllApplicationsController,
  approveApplicationController,
  rejectApplicationController,
  uploadIdentityDocController,
  removeIdentityDocController,
  uploadPortfolioFileController,
  removePortfolioFileController,
  addSupportingDocController,
  removeSupportingDocController,
} from "./sellerApplication.controller.js";

const router = Router();

// ── Existing routes (unchanged) ────────────────────────────────────────────
router.post("/", authMiddleware, createApplicationController);
router.get("/me", authMiddleware, getMyApplicationController);
router.get("/", authMiddleware, roleMiddleware("admin"), getAllApplicationsController);
router.put("/:id/approve", authMiddleware, roleMiddleware("admin"), approveApplicationController);
router.put("/:id/reject", authMiddleware, roleMiddleware("admin"), rejectApplicationController);

// ── Document upload routes (new — S3 only) ──────────────────────────────────
// Identity Document (CNIC / Passport / National ID)
router.put("/me/documents/identity",    authMiddleware, uploadIdentityDocController);
router.delete("/me/documents/identity", authMiddleware, removeIdentityDocController);

// Portfolio File
router.put("/me/documents/portfolio",    authMiddleware, uploadPortfolioFileController);
router.delete("/me/documents/portfolio", authMiddleware, removePortfolioFileController);

// Supporting Documents (max 5)
router.post("/me/documents/supporting",   authMiddleware, addSupportingDocController);
router.delete("/me/documents/supporting", authMiddleware, removeSupportingDocController);

export default router;
