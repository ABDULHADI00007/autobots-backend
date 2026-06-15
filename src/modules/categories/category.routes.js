import { Router } from "express";
import { getAllCategories, getCategoryBySlug } from "./category.controller.js";

const router = Router();

router.get("/", getAllCategories);
router.get("/:slug", getCategoryBySlug);

export default router;
