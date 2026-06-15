import { z } from "zod";

export const sellerApplicationSchema = z.object({
  portfolio: z.string().trim().min(1, "Portfolio is required"),
  experience: z.string().trim().min(1, "Experience is required"),
  linkedin: z.string().trim().optional().or(z.literal("")),
  website: z.string().trim().optional().or(z.literal("")),
});

export const approveRejectSchema = z.object({
  adminNotes: z.string().trim().optional().or(z.literal("")),
});
