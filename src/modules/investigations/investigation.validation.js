import { z } from "zod";

const investigationStatuses = ["open", "under_review", "waiting_buyer", "waiting_seller", "evidence_review", "ready_for_decision", "closed"];
const investigationPriorities = ["low", "medium", "high", "urgent"];

export const updateInvestigationSchema = z.object({
  status: z.enum(investigationStatuses, { errorMap: () => ({ message: "Status is invalid" }) }),
  priority: z.enum(investigationPriorities, { errorMap: () => ({ message: "Priority is invalid" }) }).optional(),
  assignedAdminId: z.string().trim().optional().or(z.literal("")),
  summary: z.string().trim().max(4000, "Summary too long").optional(),
});

export const createNoteSchema = z.object({
  note: z.string().trim().min(1, "Note is required"),
  category: z.string().trim().max(100).optional(),
  pinned: z.boolean().optional(),
});

export const requestInfoSchema = z.object({
  targetParticipant: z.enum(["buyer", "seller"], { errorMap: () => ({ message: "targetParticipant must be buyer or seller" }) }),
  message: z.string().trim().min(1, "Message is required"),
});
