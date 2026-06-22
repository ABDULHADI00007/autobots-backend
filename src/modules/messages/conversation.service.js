import mongoose from "mongoose";
import Conversation from "../conversations/conversation.model.js";
import ConversationParticipant from "../conversations/conversationParticipant.model.js";
import Message from "../conversations/message.model.js";
import Order from "../orders/order.model.js";
import Dispute from "../disputes/dispute.model.js";
import { getAttachmentsForParent } from "../attachments/attachment.service.js";

const conversationProjection = "conversationType orderId disputeId lastMessagePreview lastMessageAt closedAt createdAt updatedAt";

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const conversationVisibleToUser = async (conversation, userId, userRole) => {
  if (userRole === "admin") return true;

  const participant = await ConversationParticipant.findOne({ conversationId: conversation._id, userId });
  return Boolean(participant);
};

const getParticipantRecord = async (conversationId, userId) => {
  return ConversationParticipant.findOne({ conversationId, userId });
};

const getOrCreateParticipant = async (conversation, user, shouldCreate = true) => {
  const existing = await ConversationParticipant.findOne({ conversationId: conversation._id, userId: user.userId });
  if (existing) return existing;

  if (!shouldCreate) return null;

  return ConversationParticipant.create({
    conversationId: conversation._id,
    userId: user.userId,
    role: user.role,
    lastReadAt: null,
    mutedAt: null,
    archivedAt: null,
  });
};

const buildUnreadCount = async (conversationId, participant, userId) => {
  const lastReadAt = participant?.lastReadAt || null;
  const messageQuery = {
    conversationId,
  };

  if (lastReadAt) {
    messageQuery.createdAt = { $gt: lastReadAt };
  }

  if (userId) {
    messageQuery.senderId = { $ne: userId };
  }

  return Message.countDocuments(messageQuery);
};

const buildConversationPayload = async (conversation, user) => {
  const participants = await ConversationParticipant.find({ conversationId: conversation._id })
    .populate("userId", "name email role")
    .sort({ createdAt: 1 });

  const participant = await getParticipantRecord(conversation._id, user.userId);
  const unreadCount = participant ? await buildUnreadCount(conversation._id, participant, user.userId) : 0;

  return {
    conversationId: conversation._id,
    conversationType: conversation.conversationType,
    orderId: conversation.orderId,
    disputeId: conversation.disputeId,
    lastMessagePreview: conversation.lastMessagePreview,
    lastMessageAt: conversation.lastMessageAt,
    unreadCount,
    participants,
  };
};

const populateMessages = async (conversationId) => {
  const messages = await Message.find({ conversationId })
    .populate("senderId", "name email role")
    .populate("replyToMessageId")
    .sort({ createdAt: 1 });

  const attachmentsByMessageId = new Map();

  const attachments = await Promise.all(
    messages.map(async (message) => ({
      messageId: message._id.toString(),
      attachments: await getAttachmentsForParent("message", message._id),
    }))
  );

  for (const item of attachments) {
    attachmentsByMessageId.set(item.messageId, item.attachments);
  }

  return messages.map((message) => ({
    ...message.toObject(),
    attachments: attachmentsByMessageId.get(message._id.toString()) || [],
  }));
};

const loadConversationForUser = async (conversationId, user) => {
  if (!isObjectId(conversationId)) {
    throw new Error("Invalid conversation ID");
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  const allowedAsAdmin = user.role === "admin";
  const participant = await getParticipantRecord(conversation._id, user.userId);

  if (!allowedAsAdmin && !participant) {
    throw new Error("Access denied");
  }

  if (allowedAsAdmin && conversation.conversationType === "dispute") {
    await getOrCreateParticipant(conversation, user, true);
  }

  const resolvedParticipant = await getParticipantRecord(conversation._id, user.userId);
  const unreadCount = resolvedParticipant ? await buildUnreadCount(conversation._id, resolvedParticipant, user.userId) : 0;
  const participants = await ConversationParticipant.find({ conversationId: conversation._id })
    .populate("userId", "name email role")
    .sort({ createdAt: 1 });
  const messages = await populateMessages(conversation._id);

  return {
    conversation,
    participants,
    messages,
    unreadState: {
      lastReadAt: resolvedParticipant?.lastReadAt || null,
      unreadCount,
    },
  };
};

export const getOrderConversation = async (orderId) => {
  if (!isObjectId(orderId)) {
    throw new Error("Invalid order ID");
  }

  const conversation = await Conversation.findOne({ conversationType: "order", orderId });
  if (!conversation) return null;
  return conversation;
};

export const createOrderConversation = async (orderId) => {
  if (!isObjectId(orderId)) {
    throw new Error("Invalid order ID");
  }

  const order = await Order.findById(orderId).populate("buyerId", "role").populate("sellerId", "role");
  if (!order) {
    throw new Error("Order not found");
  }

  const existing = await Conversation.findOne({ conversationType: "order", orderId: order._id });
  if (existing) return existing;

  const conversation = await Conversation.create({
    conversationType: "order",
    orderId: order._id,
    disputeId: null,
    lastMessageAt: null,
    lastMessagePreview: "",
    closedAt: null,
  });

  await ConversationParticipant.create([
    { conversationId: conversation._id, userId: order.buyerId._id, role: "buyer" },
    { conversationId: conversation._id, userId: order.sellerId._id, role: "seller" },
  ]);

  return conversation;
};

export const getDisputeConversation = async (disputeId) => {
  if (!isObjectId(disputeId)) {
    throw new Error("Invalid dispute ID");
  }

  const conversation = await Conversation.findOne({ conversationType: "dispute", disputeId });
  if (!conversation) return null;
  return conversation;
};

export const createDisputeConversation = async (disputeId) => {
  if (!isObjectId(disputeId)) {
    throw new Error("Invalid dispute ID");
  }

  const dispute = await Dispute.findById(disputeId).populate({ path: "orderId", populate: [{ path: "buyerId", select: "role" }, { path: "sellerId", select: "role" }] });
  if (!dispute) {
    throw new Error("Dispute not found");
  }

  const existing = await Conversation.findOne({ conversationType: "dispute", disputeId: dispute._id });
  if (existing) return existing;

  const conversation = await Conversation.create({
    conversationType: "dispute",
    orderId: dispute.orderId._id,
    disputeId: dispute._id,
    lastMessageAt: null,
    lastMessagePreview: "",
    closedAt: null,
  });

  await ConversationParticipant.create([
    { conversationId: conversation._id, userId: dispute.orderId.buyerId._id, role: "buyer" },
    { conversationId: conversation._id, userId: dispute.orderId.sellerId._id, role: "seller" },
  ]);

  return conversation;
};

export const listConversations = async (userId, userRole) => {
  let conversations = [];

  if (userRole === "admin") {
    conversations = await Conversation.find().sort({ lastMessageAt: -1, updatedAt: -1 }).select(conversationProjection);
  } else {
    const participantRecords = await ConversationParticipant.find({ userId }).select("conversationId lastReadAt");
    const conversationIds = participantRecords.map((participant) => participant.conversationId);
    if (conversationIds.length === 0) return [];
    conversations = await Conversation.find({ _id: { $in: conversationIds } }).sort({ lastMessageAt: -1, updatedAt: -1 }).select(conversationProjection);
  }

  if (conversations.length === 0) return [];

  const conversationIds = conversations.map((c) => c._id);

  const [participantMap, participantStateList, unreadCounts] = await Promise.all([
    ConversationParticipant.find({ conversationId: { $in: conversationIds } })
      .populate("userId", "name email role")
      .sort({ createdAt: 1 }),
    ConversationParticipant.find({ conversationId: { $in: conversationIds }, userId }),
    Message.aggregate([
      {
        $match: {
          conversationId: { $in: conversationIds },
          senderId: { $ne: new mongoose.Types.ObjectId(userId) },
        },
      },
      {
        $group: {
          _id: "$conversationId",
          messages: { $push: { createdAt: "$createdAt" } },
        },
      },
    ]),
  ]);

  const participantsByConversation = participantMap.reduce((acc, p) => {
    const key = p.conversationId.toString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const participantStateByConversation = participantStateList.reduce((acc, p) => {
    acc[p.conversationId.toString()] = p;
    return acc;
  }, {});

  const messagesByConversation = unreadCounts.reduce((acc, entry) => {
    acc[entry._id.toString()] = entry.messages;
    return acc;
  }, {});

  return conversations.map((conversation) => {
    const participant = participantStateByConversation[conversation._id.toString()];
    const lastReadAt = participant?.lastReadAt || null;
    const allMessages = messagesByConversation[conversation._id.toString()] || [];
    const unreadCount = lastReadAt
      ? allMessages.filter((m) => new Date(m.createdAt) > new Date(lastReadAt)).length
      : allMessages.length;

    return {
      conversationId: conversation._id,
      conversationType: conversation.conversationType,
      orderId: conversation.orderId,
      disputeId: conversation.disputeId,
      lastMessagePreview: conversation.lastMessagePreview,
      lastMessageAt: conversation.lastMessageAt,
      unreadCount,
      participants: participantsByConversation[conversation._id.toString()] || [],
    };
  });
};

export const getConversation = async (conversationId, userId, userRole) => {
  return loadConversationForUser(conversationId, { userId, role: userRole });
};

export const sendMessage = async (conversationId, userId, userRole, body, type = "text") => {
  if (!isObjectId(conversationId)) {
    throw new Error("Invalid conversation ID");
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  let participant = await ConversationParticipant.findOne({ conversationId: conversation._id, userId });
  if (!participant) {
    throw new Error("Access denied");
  }

  const message = await Message.create({
    conversationId: conversation._id,
    senderId: userId,
    senderRole: userRole,
    type,
    body,
    metadata: {},
    replyToMessageId: null,
    visibility: participant ? "participants" : "admin",
  });

  conversation.lastMessageAt = message.createdAt;
  conversation.lastMessagePreview = body.slice(0, 140);
  await conversation.save();

  if (participant) {
    await ConversationParticipant.updateOne(
      { _id: participant._id },
      { $set: { lastReadAt: participant.lastReadAt || null } }
    );
  }

  return message;
};

export const markConversationRead = async (conversationId, userId, userRole) => {
  if (!isObjectId(conversationId)) {
    throw new Error("Invalid conversation ID");
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  let participant = await ConversationParticipant.findOne({ conversationId: conversation._id, userId });
  if (!participant) {
    throw new Error("Access denied");
  }

  participant.lastReadAt = new Date();
  await participant.save();

  return participant;
};
