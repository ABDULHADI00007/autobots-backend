import { z } from "zod";

const objectIdRegex = /^[a-f\d]{24}$/i;

export const conversationIdSchema = z.object({
  conversationId: z.string().regex(objectIdRegex, "Invalid conversation ID"),
});

export const listConversationsSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
});

export const sendMessageSchema = z.object({
  body: z.string().trim().optional().default(""),
  type: z.enum(["text"]).optional().default("text"),
});
