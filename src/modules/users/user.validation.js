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

export const buyerAdminListSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().optional().default(""),
  status: z.enum(["all", "active", "suspended"]).optional().default("all"),
  risk: z.union([z.string(), z.array(z.string())]).optional(),
  sortBy: z.enum(["name", "email", "createdAt", "totalOrders", "totalSpend", "disputesOpened", "refundCount"]).optional().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
}).transform((data) => ({
  ...data,
  risk: Array.isArray(data.risk)
    ? data.risk
    : typeof data.risk === "string"
      ? data.risk.split(",").map((value) => value.trim()).filter(Boolean)
      : [],
}));

export const roleUpdateSchema = z.object({
  role: z.enum(["buyer", "seller"], {
    errorMap: () => ({ message: "Role must be buyer or seller" }),
  }),
});
