import { z } from "zod";

const objectIdRegex = /^[a-f\d]{24}$/i;

export const createOrderSchema = z.object({
  listingId: z.string().regex(objectIdRegex, "Invalid listing ID"),
});

export const checkoutSchema = z.object({
  listingId: z.string().regex(objectIdRegex, "Invalid listing ID"),
});

export const requestCancellationSchema = z.object({
  reason: z.string().trim().min(1, "Cancellation reason is required"),
  notes: z.string().trim().optional().or(z.literal("")),
});

export const adminCancellationSchema = z.object({
  adminNotes: z.string().trim().optional().or(z.literal("")),
});
