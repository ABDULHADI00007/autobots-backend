import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import roleMiddleware from "../../middleware/role.middleware.js";
import {
  getInvestigationController,
  updateInvestigationController,
  getNotesController,
  createNoteController,
  updateNoteController,
  deleteNoteController,
  requestInfoController,
} from "./investigation.controller.js";

const router = Router({ mergeParams: true }); // mergeParams for :id from parent

const admin = [authMiddleware, roleMiddleware("admin")];

router.get("/investigation",             ...admin, getInvestigationController);
router.patch("/investigation",           ...admin, updateInvestigationController);
router.get("/notes",                     ...admin, getNotesController);
router.post("/notes",                    ...admin, createNoteController);
router.patch("/notes/:noteId",           ...admin, updateNoteController);
router.delete("/notes/:noteId",          ...admin, deleteNoteController);
router.post("/request-info",             ...admin, requestInfoController);

export default router;
