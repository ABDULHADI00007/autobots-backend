import connectDB from "../config/db.js";
import Order from "../modules/orders/order.model.js";
import Dispute from "../modules/disputes/dispute.model.js";
import Conversation from "../modules/conversations/conversation.model.js";
import "../modules/users/user.model.js"; // register User schema for populate
import { createOrderConversation, createDisputeConversation } from "../modules/messages/conversation.service.js";

async function backfill() {
  await connectDB();

  // ── Orders ────────────────────────────────────────────────
  const orders = await Order.find().select("_id").lean();
  const totalOrders = orders.length;
  let orderCreated = 0;
  let orderSkipped = 0;

  for (const order of orders) {
    const existing = await Conversation.findOne({ conversationType: "order", orderId: order._id }).lean();
    if (existing) {
      orderSkipped++;
      continue;
    }
    try {
      await createOrderConversation(order._id);
      orderCreated++;
    } catch (err) {
      console.error(`  [order ${order._id}] failed: ${err.message}`);
    }
  }

  // ── Disputes ──────────────────────────────────────────────
  const disputes = await Dispute.find().select("_id").lean();
  const totalDisputes = disputes.length;
  let disputeCreated = 0;
  let disputeSkipped = 0;

  for (const dispute of disputes) {
    const existing = await Conversation.findOne({ conversationType: "dispute", disputeId: dispute._id }).lean();
    if (existing) {
      disputeSkipped++;
      continue;
    }
    try {
      await createDisputeConversation(dispute._id);
      disputeCreated++;
    } catch (err) {
      console.error(`  [dispute ${dispute._id}] failed: ${err.message}`);
    }
  }

  // ── Summary ───────────────────────────────────────────────
  console.log("\n── Backfill Complete ─────────────────────────────────");
  console.log(`  Orders scanned:               ${totalOrders}`);
  console.log(`  Order conversations created:  ${orderCreated}`);
  console.log(`  Orders already valid:         ${orderSkipped}`);
  console.log(`  Disputes scanned:             ${totalDisputes}`);
  console.log(`  Dispute conversations created:${disputeCreated}`);
  console.log(`  Disputes already valid:       ${disputeSkipped}`);
  console.log("──────────────────────────────────────────────────────\n");

  process.exit(0);
}

backfill().catch((err) => {
  console.error("Backfill failed:", err.message);
  process.exit(1);
});
