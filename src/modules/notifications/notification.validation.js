import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const readParams = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, "Invalid notification id"),
  }),
});

export const paginationQuery = z.object({
  query: z.object({
    page: z.preprocess((value) => {
      if (typeof value === "string") return Number(value);
      return value;
    }, z.number().int().positive().default(1)),
    limit: z.preprocess((value) => {
      if (typeof value === "string") return Number(value);
      return value;
    }, z.number().int().positive().max(100).default(50)),
  }),
});

export const readByReferenceQuery = z.object({
  query: z.object({
    referenceType: z.string().min(1),
    referenceId: z.string().min(1),
  }),
});
