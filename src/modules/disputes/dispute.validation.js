import { z } from "zod";

const objectIdRegex = /^[a-f\d]{24}$/i;
const objectId = z.string().regex(objectIdRegex, "Invalid ID");

export const createDisputeSchema = z.object({
  orderId: z.string().min(1, "orderId is required"),
  reason: z.string().trim().min(5, "Reason must be at least 5 characters"),
});

export const disputeIdParamSchema = z.object({
  id: objectId,
});

export const adminResolveSchema = z.object({
  decision: z.enum(["release", "refund"], { errorMap: () => ({ message: "Decision must be release or refund" }) }),
  adminNotes: z.string().trim().optional(),
});

export const adminResolutionSchema = z.object({
  decision: z.enum(["buyer_wins", "seller_wins"], { errorMap: () => ({ message: "Decision must be buyer_wins or seller_wins" }) }),
  notes: z.string().trim().min(1, "Resolution notes are required"),
});
