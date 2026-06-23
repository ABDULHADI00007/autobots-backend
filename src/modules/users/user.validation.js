import { z } from "zod";

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
});

export const buyerAdminNoteSchema = z.object({
  note: z.string().trim().min(1, "Note is required"),
});

export const buyerSuspendSchema = z.object({
  reason: z.string().trim().optional().default(""),
});

export const roleUpdateSchema = z.object({
  role: z.enum(["buyer", "seller"], {
    errorMap: () => ({ message: "Role must be buyer or seller" }),
  }),
});
