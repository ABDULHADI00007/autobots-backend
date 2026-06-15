import { z } from "zod";

const objectIdRegex = /^[a-f\d]{24}$/i;

export const createRefundSchema = z.object({
  orderId: z.string().regex(objectIdRegex, "Invalid order ID"),
  reason: z.string().trim().min(10, "Reason must be at least 10 characters").max(1000, "Reason must be at most 1000 characters"),
});

export const adminNotesSchema = z.object({
  adminNotes: z.string().trim().optional(),
});
