import { z } from "zod";

const objectIdRegex = /^[a-f\d]{24}$/i;

export const createReviewSchema = z.object({
  orderId: z.string().regex(objectIdRegex, "Invalid order ID"),
  rating: z.number().int().min(1, "Rating minimum 1").max(5, "Rating maximum 5"),
  comment: z.string().trim().min(10, "Comment must be at least 10 characters").max(1000, "Comment must be at most 1000 characters"),
});

export const updateReviewSchema = z.object({
  rating: z.number().int().min(1, "Rating minimum 1").max(5, "Rating maximum 5").optional(),
  comment: z.string().trim().min(10, "Comment must be at least 10 characters").max(1000, "Comment must be at most 1000 characters").optional(),
});
