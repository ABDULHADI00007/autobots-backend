import { z } from "zod";

const objectIdRegex = /^[a-f\d]{24}$/i;

export const createOrderSchema = z.object({
  listingId: z.string().regex(objectIdRegex, "Invalid listing ID"),
});

export const checkoutSchema = z.object({
  listingId: z.string().regex(objectIdRegex, "Invalid listing ID"),
});
