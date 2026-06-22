import { z } from "zod";

export const createDisputeSchema = z.object({
  orderId: z.string().min(1, "orderId is required"),
  reason: z.string().trim().min(5, "Reason must be at least 5 characters"),
});

export const adminResolveSchema = z.object({
  decision: z.enum(["release", "refund"], { errorMap: () => ({ message: "Decision must be release or refund" }) }),
  adminNotes: z.string().trim().optional(),
});
