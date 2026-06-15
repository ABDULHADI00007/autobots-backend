import { z } from "zod";

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
});

export const roleUpdateSchema = z.object({
  role: z.enum(["buyer", "seller"], {
    errorMap: () => ({ message: "Role must be buyer or seller" }),
  }),
});
