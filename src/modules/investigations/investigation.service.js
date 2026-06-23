import Investigation from "./investigation.model.js";
import AdminNote from "../adminNotes/adminNote.model.js";
import TimelineEvent from "../timeline/timelineEvent.model.js";
import Dispute from "../disputes/dispute.model.js";
import User from "../users/user.model.js";

const VALID_STATUSES = ["open", "under_review", "waiting_buyer", "waiting_seller", "evidence_review", "ready_for_decision", "closed"];
const VALID_PRIORITIES = ["low", "medium", "high", "urgent"];

// ── helpers ──────────────────────────────────────────────────

async function writeTimeline(disputeId, eventType, title, description, actorId, payload = {}, visibility = "internal") {
  await TimelineEvent.create({ scopeType: "dispute", scopeId: disputeId, eventType, actorId, title, description, payload, visibility });
}

async function ensureInvestigation(disputeId) {
  let inv = await Investigation.findOne({ disputeId });
  if (!inv) {
    inv = await Investigation.create({ disputeId, status: "open" });
    await writeTimeline(disputeId, "InvestigationStarted", "Investigation opened", "", null);
  }
  return inv;
}

// ── Get investigation ─────────────────────────────────────────

export const getInvestigation = async (disputeId) => {
  const inv = await ensureInvestigation(disputeId);
  return Investigation.findById(inv._id).populate("assignedAdminId", "name email");
};

// ── Update investigation (assign, status, priority, summary) ──

export const updateInvestigation = async (disputeId, adminId, { assignedAdminId, priority, status, summary }) => {
  const inv = await ensureInvestigation(disputeId);

  if (status && !VALID_STATUSES.includes(status)) throw new Error("Invalid investigation status");
  if (priority && !VALID_PRIORITIES.includes(priority)) throw new Error("Invalid priority");

  const prevStatus = inv.status;

  if (assignedAdminId !== undefined) {
    const admin = await User.findOne({ _id: assignedAdminId, role: "admin" });
    if (!admin) throw new Error("Assigned user is not an admin");
    inv.assignedAdminId = assignedAdminId;
    await writeTimeline(disputeId, "AssignedAdmin", `Case assigned to ${admin.name}`, "", adminId, { assignedAdminId });
  }
  if (priority !== undefined) inv.priority = priority;
  if (summary !== undefined) inv.summary = summary;
  if (status !== undefined) {
    inv.status = status;
    if (status !== prevStatus) {
      await writeTimeline(disputeId, "StatusChanged", `Status changed to ${status}`, "", adminId, { from: prevStatus, to: status });
    }
    if (status === "closed" && !inv.closedAt) {
      inv.closedAt = new Date();
      await writeTimeline(disputeId, "InvestigationClosed", "Investigation closed", "", adminId, { closedAt: inv.closedAt });
    }
  }

  inv.lastActivityAt = new Date();
  await inv.save();
  return Investigation.findById(inv._id).populate("assignedAdminId", "name email");
};

// ── Admin Notes ───────────────────────────────────────────────

export const getNotes = async (disputeId) => {
  const inv = await ensureInvestigation(disputeId);
  const notes = await AdminNote.find({ investigationId: inv._id })
    .populate("adminId", "name email")
    .sort({ pinned: -1, createdAt: -1 });
  return notes;
};

export const createNote = async (disputeId, adminId, { note, category, pinned }) => {
  const inv = await ensureInvestigation(disputeId);
  const created = await AdminNote.create({ investigationId: inv._id, adminId, note, category: category || "general", pinned: !!pinned });
  inv.lastActivityAt = new Date();
  await inv.save();
  await writeTimeline(disputeId, "InternalNoteCreated", "Internal note added", "", adminId, { category: category || "general", pinned: !!pinned });
  if (pinned) {
    await writeTimeline(disputeId, "AdminNotePinned", "Pinned internal note added", "", adminId);
  }
  return AdminNote.findById(created._id).populate("adminId", "name email");
};

export const updateNote = async (disputeId, noteId, adminId, { note, category, pinned }) => {
  const inv = await ensureInvestigation(disputeId);
  const existing = await AdminNote.findOne({ _id: noteId, investigationId: inv._id });
  if (!existing) throw new Error("Note not found");
  if (note !== undefined) existing.note = note;
  if (category !== undefined) existing.category = category;
  if (pinned !== undefined) {
    existing.pinned = pinned;
    if (pinned) await writeTimeline(disputeId, "AdminNotePinned", "Internal note pinned", "", adminId);
  }
  await existing.save();
  inv.lastActivityAt = new Date();
  await inv.save();
  return AdminNote.findById(existing._id).populate("adminId", "name email");
};

export const deleteNote = async (disputeId, noteId) => {
  const inv = await ensureInvestigation(disputeId);
  const existing = await AdminNote.findOne({ _id: noteId, investigationId: inv._id });
  if (!existing) throw new Error("Note not found");
  await existing.deleteOne();
};

// ── Request info ──────────────────────────────────────────────

export const requestInfo = async (disputeId, adminId, { targetParticipant, message }) => {
  if (!["buyer", "seller"].includes(targetParticipant)) throw new Error("targetParticipant must be buyer or seller");
  if (!message?.trim()) throw new Error("message is required");

  const dispute = await Dispute.findById(disputeId);
  if (!dispute) throw new Error("Dispute not found");

  const inv = await ensureInvestigation(disputeId);

  // visible to participants so buyer/seller can see the request
  await writeTimeline(disputeId, "InfoRequested", `Information requested from ${targetParticipant}`, message.trim(), adminId, { targetParticipant, message: message.trim() }, "participants");

  inv.lastActivityAt = new Date();
  await inv.save();

  return { disputeId, targetParticipant, message: message.trim(), requestedAt: new Date() };
};
