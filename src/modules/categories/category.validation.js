import { z } from "zod";

export const slugParamSchema = z.object({
  slug: z.string().min(1),
});
