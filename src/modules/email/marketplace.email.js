import { sendEmail } from "./email.service.js";
import User from "../users/user.model.js";
import {
  buildOrderConfirmationTemplate,
  buildNewOrderTemplate,
  buildOrderAcceptedTemplate,
  buildOrderDeliveredTemplate,
  buildCancellationApprovedTemplate,
  buildCancellationRejectedTemplate,
  buildRefundApprovedTemplate,
  buildRefundRejectedTemplate,
  buildDisputeOpenedTemplate,
  buildDisputeResolvedTemplate,
  buildNewMessageTemplate,
  buildRevisionRequestedTemplate,
  buildCancellationRequestedTemplate,
  buildRefundDecisionTemplate,
  buildReviewReceivedTemplate,
  buildSellerApplicationSubmittedTemplate,
  buildSellerApplicationApprovedTemplate,
  buildSellerApplicationRejectedTemplate,
  buildNewSellerApplicationAdminTemplate,
  buildSellerApplicationResubmittedAdminTemplate,
  buildAdminRefundRequestedTemplate,
  buildAdminCancellationRequestedTemplate,
  buildAdminDisputeOpenedTemplate,
} from "./email.templates.js";
import { env } from "../../config/env.js";

const normalizeUrl = (url) => url.replace(/\/+$/, "");
const getOrderUrl = (orderId) => `${normalizeUrl(env.FRONTEND_URL)}/orders/${orderId}`;
const getConversationUrl = (conversationId) => `${normalizeUrl(env.FRONTEND_URL)}/messages/${conversationId}`;
const getApplicationUrl = (applicationId) => `${normalizeUrl(env.FRONTEND_URL)}/seller-applications/${applicationId}`;
const getAdminApplicationUrl = (applicationId) => `${normalizeUrl(env.FRONTEND_URL)}/admin/seller-applications/${applicationId}`;
const getSellerDashboardUrl = () => `${normalizeUrl(env.FRONTEND_URL)}/seller/dashboard`;

const getFirstName = (name = "") => {
  const trimmed = String(name).trim();
  if (!trimmed) return "there";
  return trimmed.split(" ")[0];
};

const sendMarketplaceEmail = async ({ recipient, subject, html, text, emailType }) => {
  try {
    const result = await sendEmail({ recipient, subject, html, text });
    console.log("Marketplace email sent", {
      emailType,
      recipient,
      status: "sent",
      providerResponse: { messageId: result.id || null },
    });
    return result;
  } catch (error) {
    console.error("Marketplace email failed", {
      emailType,
      recipient,
      status: "failed",
      error: error.message || "Unknown",
    });
    return null;
  }
};

const getAdminRecipients = async () => {
  const admins = await User.find({ role: "admin", email: { $exists: true, $ne: "" } }).select("name email");
  return admins
    .filter((admin) => admin.email)
    .map((admin) => ({ email: admin.email, name: admin.name }));
};

export const sendOrderConfirmationEmail = async ({ buyer, order, listingTitle, amount }) => {
  const firstName = getFirstName(buyer?.name);
  const html = buildOrderConfirmationTemplate({
    firstName,
    listingTitle,
    amount,
    orderUrl: getOrderUrl(order._id || order),
  });
  const text = `Hi ${firstName},\n\nYour order for "${listingTitle}" has been confirmed. Order #${order._id || order}.\n\nView your order: ${getOrderUrl(order._id || order)}`;

  return sendMarketplaceEmail({
    recipient: { email: buyer.email, name: buyer.name },
    subject: "Your order is confirmed",
    html,
    text,
    emailType: "order_confirmation",
  });
};

export const sendNewOrderEmailSeller = async ({ seller, order, listingTitle, amount, buyerName }) => {
  const firstName = getFirstName(seller?.name);
  const html = buildNewOrderTemplate({
    firstName,
    listingTitle,
    amount,
    buyerName,
    orderUrl: getOrderUrl(order._id || order),
  });
  const text = `Hi ${firstName},\n\nA new order has been placed for "${listingTitle}" by ${buyerName}. Order #${order._id || order}.\n\nView the order: ${getOrderUrl(order._id || order)}`;

  return sendMarketplaceEmail({
    recipient: { email: seller.email, name: seller.name },
    subject: "New order received",
    html,
    text,
    emailType: "new_order",
  });
};

export const sendOrderAcceptedEmailBuyer = async ({ buyer, order, sellerName }) => {
  const firstName = getFirstName(buyer?.name);
  const html = buildOrderAcceptedTemplate({
    firstName,
    sellerName,
    orderUrl: getOrderUrl(order._id || order),
  });
  const text = `Hi ${firstName},\n\n${sellerName} has accepted your order. Order #${order._id || order}.\n\nView the order: ${getOrderUrl(order._id || order)}`;

  return sendMarketplaceEmail({
    recipient: { email: buyer.email, name: buyer.name },
    subject: "Your order was accepted",
    html,
    text,
    emailType: "order_accepted",
  });
};

export const sendOrderDeliveredEmailBuyer = async ({ buyer, order, sellerName }) => {
  const firstName = getFirstName(buyer?.name);
  const html = buildOrderDeliveredTemplate({
    firstName,
    sellerName,
    orderUrl: getOrderUrl(order._id || order),
  });
  const text = `Hi ${firstName},\n\n${sellerName} has delivered your order. Order #${order._id || order}.\n\nView the order: ${getOrderUrl(order._id || order)}`;

  return sendMarketplaceEmail({
    recipient: { email: buyer.email, name: buyer.name },
    subject: "Your order has been delivered",
    html,
    text,
    emailType: "order_delivered",
  });
};

export const sendCancellationRequestedEmailSeller = async ({ seller, order, buyerName }) => {
  const firstName = getFirstName(seller?.name);
  const html = buildCancellationRequestedTemplate({
    firstName,
    orderUrl: getOrderUrl(order._id || order),
    buyerName,
  });
  const text = `Hi ${firstName},\n\n${buyerName} has requested cancellation for order #${order._id || order}.\n\nView the order: ${getOrderUrl(order._id || order)}`;

  return sendMarketplaceEmail({
    recipient: { email: seller.email, name: seller.name },
    subject: "Cancellation requested",
    html,
    text,
    emailType: "cancellation_requested",
  });
};

export const sendCancellationApprovedEmailBuyer = async ({ buyer, order }) => {
  const firstName = getFirstName(buyer?.name);
  const html = buildCancellationApprovedTemplate({
    firstName,
    orderUrl: getOrderUrl(order._id || order),
  });
  const text = `Hi ${firstName},\n\nYour cancellation request for order #${order._id || order} has been approved.\n\nView the order: ${getOrderUrl(order._id || order)}`;

  return sendMarketplaceEmail({
    recipient: { email: buyer.email, name: buyer.name },
    subject: "Cancellation approved",
    html,
    text,
    emailType: "cancellation_approved",
  });
};

export const sendCancellationRejectedEmailBuyer = async ({ buyer, order }) => {
  const firstName = getFirstName(buyer?.name);
  const html = buildCancellationRejectedTemplate({
    firstName,
    orderUrl: getOrderUrl(order._id || order),
  });
  const text = `Hi ${firstName},\n\nYour cancellation request for order #${order._id || order} has been rejected.\n\nView the order: ${getOrderUrl(order._id || order)}`;

  return sendMarketplaceEmail({
    recipient: { email: buyer.email, name: buyer.name },
    subject: "Cancellation rejected",
    html,
    text,
    emailType: "cancellation_rejected",
  });
};

export const sendRefundApprovedEmailBuyer = async ({ buyer, order }) => {
  const firstName = getFirstName(buyer?.name);
  const html = buildRefundApprovedTemplate({
    firstName,
    orderUrl: getOrderUrl(order._id || order),
  });
  const text = `Hi ${firstName},\n\nYour refund for order #${order._id || order} has been approved.\n\nView the refund details: ${getOrderUrl(order._id || order)}`;

  return sendMarketplaceEmail({
    recipient: { email: buyer.email, name: buyer.name },
    subject: "Refund approved",
    html,
    text,
    emailType: "refund_approved",
  });
};

export const sendRefundRejectedEmailBuyer = async ({ buyer, order }) => {
  const firstName = getFirstName(buyer?.name);
  const html = buildRefundRejectedTemplate({
    firstName,
    orderUrl: getOrderUrl(order._id || order),
  });
  const text = `Hi ${firstName},\n\nYour refund request for order #${order._id || order} has been rejected.\n\nView the order: ${getOrderUrl(order._id || order)}`;

  return sendMarketplaceEmail({
    recipient: { email: buyer.email, name: buyer.name },
    subject: "Refund rejected",
    html,
    text,
    emailType: "refund_rejected",
  });
};

export const sendRefundDecisionEmailSeller = async ({ seller, order, decision }) => {
  const firstName = getFirstName(seller?.name);
  const html = buildRefundDecisionTemplate({
    firstName,
    decision,
    orderUrl: getOrderUrl(order._id || order),
  });
  const text = `Hi ${firstName},\n\nA refund decision has been made for order #${order._id || order}: ${decision}.\n\nView the order: ${getOrderUrl(order._id || order)}`;

  return sendMarketplaceEmail({
    recipient: { email: seller.email, name: seller.name },
    subject: `Refund ${decision}`,
    html,
    text,
    emailType: "refund_decision",
  });
};

export const sendDisputeOpenedEmailSeller = async ({ seller, order, openerRole }) => {
  const firstName = getFirstName(seller?.name);
  const html = buildDisputeOpenedTemplate({
    firstName,
    openerRole,
    orderUrl: getOrderUrl(order._id || order),
  });
  const text = `Hi ${firstName},\n\nA dispute was opened for order #${order._id || order} by ${openerRole}.\n\nView the dispute: ${getOrderUrl(order._id || order)}`;

  return sendMarketplaceEmail({
    recipient: { email: seller.email, name: seller.name },
    subject: "Dispute opened",
    html,
    text,
    emailType: "dispute_opened",
  });
};

export const sendDisputeResolvedEmailParticipant = async ({ recipient, order, decision, openerRole }) => {
  const firstName = getFirstName(recipient?.name);
  const html = buildDisputeResolvedTemplate({
    firstName,
    decision,
    orderUrl: getOrderUrl(order._id || order),
  });
  const text = `Hi ${firstName},\n\nA dispute for order #${order._id || order} was resolved: ${decision}.\n\nView the order: ${getOrderUrl(order._id || order)}`;

  return sendMarketplaceEmail({
    recipient: { email: recipient.email, name: recipient.name },
    subject: "Dispute resolved",
    html,
    text,
    emailType: "dispute_resolved",
  });
};

export const sendNewMessageEmailRecipient = async ({ recipient, conversationId, messagePreview }) => {
  const firstName = getFirstName(recipient?.name);
  const html = buildNewMessageTemplate({
    firstName,
    messagePreview,
    conversationUrl: getConversationUrl(conversationId),
  });
  const text = `Hi ${firstName},\n\nYou have a new message: ${messagePreview}\n\nView the conversation: ${getConversationUrl(conversationId)}`;

  return sendMarketplaceEmail({
    recipient: { email: recipient.email, name: recipient.name },
    subject: "New message received",
    html,
    text,
    emailType: "new_message",
  });
};

export const sendSellerApplicationSubmittedEmailApplicant = async ({ applicant, application }) => {
  const firstName = getFirstName(applicant?.name);
  const applicationUrl = getApplicationUrl(application._id || application);
  const html = buildSellerApplicationSubmittedTemplate({
    firstName,
    applicationUrl,
    reviewTimeText: "within 3 business days",
  });
  const text = `Hi ${firstName},\n\nYour seller application has been received. Our team will review it within 3 business days.\n\nView your application: ${applicationUrl}\n\nNo action is required from you right now.`;

  return sendMarketplaceEmail({
    recipient: { email: applicant.email, name: applicant.name },
    subject: "Seller application received",
    html,
    text,
    emailType: "seller_application_submitted",
  });
};

export const sendSellerApplicationApprovedEmailApplicant = async ({ applicant }) => {
  const firstName = getFirstName(applicant?.name);
  const sellerDashboardUrl = getSellerDashboardUrl();
  const html = buildSellerApplicationApprovedTemplate({
    firstName,
    sellerDashboardUrl,
  });
  const text = `Congratulations ${firstName},\n\nYour seller application has been approved and your seller account is now active.\n\nGo to seller dashboard: ${sellerDashboardUrl}`;

  return sendMarketplaceEmail({
    recipient: { email: applicant.email, name: applicant.name },
    subject: "Seller application approved",
    html,
    text,
    emailType: "seller_application_approved",
  });
};

export const sendSellerApplicationRejectedEmailApplicant = async ({ applicant, reason, application }) => {
  const firstName = getFirstName(applicant?.name);
  const resubmitUrl = getApplicationUrl(application._id || application);
  const html = buildSellerApplicationRejectedTemplate({
    firstName,
    reason,
    resubmitUrl,
  });
  const text = `Hi ${firstName},\n\nWe reviewed your seller application and it was not approved.${reason ? ` Reason: ${reason}.` : ""}\n\nUpdate your application and submit again: ${resubmitUrl}`;

  return sendMarketplaceEmail({
    recipient: { email: applicant.email, name: applicant.name },
    subject: "Seller application update needed",
    html,
    text,
    emailType: "seller_application_rejected",
  });
};

export const sendNewSellerApplicationAdminEmail = async ({ applicantName, application }) => {
  const applicationUrl = getAdminApplicationUrl(application._id || application);
  const submittedAt = application.createdAt ? new Date(application.createdAt).toLocaleString() : "just now";
  const html = buildNewSellerApplicationAdminTemplate({
    applicantName,
    applicationUrl,
    submittedAt,
  });
  const text = `A new seller application was submitted by ${applicantName} on ${submittedAt}.\n\nReview it here: ${applicationUrl}`;

  return sendAdminEmails({
    subject: "New seller application received",
    html,
    text,
    emailType: "admin_seller_application_new",
  });
};

export const sendSellerApplicationResubmittedAdminEmail = async ({ applicantName, application }) => {
  const applicationUrl = getAdminApplicationUrl(application._id || application);
  const resubmittedAt = application.updatedAt ? new Date(application.updatedAt).toLocaleString() : "just now";
  const html = buildSellerApplicationResubmittedAdminTemplate({
    applicantName,
    applicationUrl,
    resubmittedAt,
  });
  const text = `${applicantName} has resubmitted their seller application on ${resubmittedAt}.\n\nReview it here: ${applicationUrl}`;

  return sendAdminEmails({
    subject: "Seller application resubmitted",
    html,
    text,
    emailType: "admin_seller_application_resubmitted",
  });
};

export const sendRevisionRequestedEmailSeller = async ({ seller, order, buyerName }) => {
  const firstName = getFirstName(seller?.name);
  const html = buildRevisionRequestedTemplate({
    firstName,
    buyerName,
    orderUrl: getOrderUrl(order._id || order),
  });
  const text = `Hi ${firstName},\n\n${buyerName} requested a revision for order #${order._id || order}.\n\nView the order: ${getOrderUrl(order._id || order)}`;

  return sendMarketplaceEmail({
    recipient: { email: seller.email, name: seller.name },
    subject: "Revision requested",
    html,
    text,
    emailType: "revision_requested",
  });
};

export const sendReviewReceivedEmailSeller = async ({ seller, order, buyerName }) => {
  const firstName = getFirstName(seller?.name);
  const html = buildReviewReceivedTemplate({
    firstName,
    buyerName,
    orderUrl: getOrderUrl(order._id || order),
  });
  const text = `Hi ${firstName},\n\nYou received a new review from ${buyerName} for order #${order._id || order}.\n\nView the order: ${getOrderUrl(order._id || order)}`;

  return sendMarketplaceEmail({
    recipient: { email: seller.email, name: seller.name },
    subject: "New review received",
    html,
    text,
    emailType: "review_received",
  });
};

const sendAdminEmails = async ({ subject, html, text, emailType }) => {
  const adminRecipients = await getAdminRecipients();
  if (adminRecipients.length === 0) return null;

  const results = [];
  for (const admin of adminRecipients) {
    // Side effects only; do not block workflow
    try {
      results.push(
        await sendMarketplaceEmail({
          recipient: { email: admin.email, name: admin.name },
          subject,
          html,
          text,
          emailType,
        })
      );
    } catch (_) {
      // sendMarketplaceEmail already logs errors
    }
  }
  return results;
};

export const sendAdminRefundRequestedEmail = async ({ order, buyerName }) => {
  const html = buildAdminRefundRequestedTemplate({
    buyerName,
    orderUrl: getOrderUrl(order._id || order),
  });
  const text = `A refund was requested for order #${order._id || order} by ${buyerName}.\n\nReview it here: ${getOrderUrl(order._id || order)}`;

  return sendAdminEmails({
    subject: "Refund requested",
    html,
    text,
    emailType: "admin_refund_requested",
  });
};

export const sendAdminCancellationRequestedEmail = async ({ order, buyerName }) => {
  const html = buildAdminCancellationRequestedTemplate({
    buyerName,
    orderUrl: getOrderUrl(order._id || order),
  });
  const text = `A cancellation was requested for order #${order._id || order} by ${buyerName}.\n\nReview it here: ${getOrderUrl(order._id || order)}`;

  return sendAdminEmails({
    subject: "Cancellation requested",
    html,
    text,
    emailType: "admin_cancellation_requested",
  });
};

export const sendAdminDisputeOpenedEmail = async ({ order, openerRole }) => {
  const html = buildAdminDisputeOpenedTemplate({
    openerRole,
    orderUrl: getOrderUrl(order._id || order),
  });
  const text = `A dispute was opened for order #${order._id || order} by ${openerRole}.\n\nReview it here: ${getOrderUrl(order._id || order)}`;

  return sendAdminEmails({
    subject: "Dispute opened",
    html,
    text,
    emailType: "admin_dispute_opened",
  });
};
