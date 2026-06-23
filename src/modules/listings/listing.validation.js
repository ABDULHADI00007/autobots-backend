import mongoose from "mongoose";
import { z } from "zod";

const objectId = z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
  message: "Invalid id",
});

const optionalText = z.string().trim().optional().or(z.literal(""));

export const listingCreateSchema = z.object({
  categoryId: objectId,
  title: z.string().trim().min(1, "Title is required"),
  outcome: z.string().trim().min(1, "Outcome is required"),
  shortDescription: z.string().trim().min(1, "Short description is required"),
  fullDescription: z.string().trim().min(1, "Full description is required"),
  difficultyLevel: z.enum(["easy", "moderate", "advanced"], {
    message: "Difficulty level must be easy, moderate, or advanced",
  }),
  requiredTools: z.array(z.string().trim().min(1)).optional(),
  monthlySoftwareCost: z.number().min(0, "Monthly software cost must be positive").optional(),
  price: z.number().positive("Price must be positive"),
  demoVideo: optionalText,
  documentation: optionalText,
  setupGuide: optionalText,
  estimatedOutcomes: optionalText,
  deliverables: z.array(z.string().trim().min(1)).optional(),
});

export const listingUpdateSchema = listingCreateSchema.partial();

export const listingModerationSchema = z.object({
  feedback: z.string().trim().optional().default(""),
});

export const listingIdParamSchema = z.object({
  id: objectId,
});

export const listingSlugParamSchema = z.object({
  slug: z.string().trim().min(1, "Slug is required"),
});

export const listingQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  difficulty: z.enum(["easy", "moderate", "advanced"]).optional(),
  verificationStatus: z.enum(["verified", "unverified"]).optional(),
});
