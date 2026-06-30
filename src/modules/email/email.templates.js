import { BaseEmailLayout, BrandFooter, BrandHeader } from "./email.layout.js";
import { Button, Divider, SectionTitle, Text } from "./email.components.js";

export const createBaseTemplate = ({ title, bodyHtml, previewText }) => {
  const mainContent = `
    ${BrandHeader()}
    <tr>
      <td style="padding:24px 0 0;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          ${SectionTitle({ content: title })}
          ${Text({ content: bodyHtml })}
        </table>
      </td>
    </tr>
    ${BrandFooter()}
  `;

  return BaseEmailLayout({ previewText, body: mainContent });
};

const buildAuthTemplate = ({ title, bodyHtml, previewText }) =>
  createBaseTemplate({ title, bodyHtml, previewText });

export const buildInfrastructureTestTemplate = () => {
  const bodyHtml = `
    <p style="margin:0 0 12px;">This is an internal email infrastructure test for Autobots Marketplace.</p>
    ${Divider()}
    <p style="margin:0 0 24px; color:#475569;">The reusable email system is initialized and the template architecture is working.</p>
    ${Button({ label: "Open dashboard", url: "https://autobots.ai" })}
  `;

  return createBaseTemplate({
    title: "Autobots Marketplace Email Test",
    bodyHtml,
    previewText: "Internal email infrastructure test.",
  });
};

export const buildWelcomeEmailTemplate = ({ firstName, dashboardUrl }) => {
  const bodyHtml = `
    <p style="margin:0 0 12px;">Welcome to Marketplace, ${firstName}.</p>
    <p style="margin:0 0 16px; color:#475569;">We are thrilled to have you on board. Your new marketplace account is ready, and your dashboard is waiting.</p>
    ${Button({ label: "Go to Dashboard", url: dashboardUrl })}
    ${Divider()}
    <p style="margin:0; color:#64748b;">If you have any questions, we are here to help.</p>
  `;

  return buildAuthTemplate({
    title: "Welcome to Marketplace",
    bodyHtml,
    previewText: "Welcome to Marketplace. Start by visiting your dashboard.",
  });
};

export const buildVerificationEmailTemplate = ({ firstName, verificationUrl, expirationText }) => {
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hi ${firstName},</p>
    <p style="margin:0 0 16px; color:#475569;">Please verify your email address to secure your account and access your dashboard.</p>
    ${Button({ label: "Verify Email", url: verificationUrl })}
    ${Divider()}
    <p style="margin:0 0 8px;">This verification link expires in ${expirationText}.</p>
    <p style="margin:0; color:#64748b;">If you did not create an account, you can safely ignore this email.</p>
  `;

  return buildAuthTemplate({
    title: "Verify Your Email Address",
    bodyHtml,
    previewText: "Verify your email to complete registration.",
  });
};

export const buildVerificationSuccessEmailTemplate = ({ firstName }) => {
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hi ${firstName},</p>
    <p style="margin:0 0 16px; color:#475569;">Your email address has been verified successfully. You can now access all account features.</p>
    ${Divider()}
    <p style="margin:0; color:#64748b;">If you did not verify your email, please contact support immediately.</p>
  `;

  return buildAuthTemplate({
    title: "Email Verified Successfully",
    bodyHtml,
    previewText: "Your email has been verified.",
  });
};

export const buildForgotPasswordEmailTemplate = ({ firstName, resetUrl, expirationText }) => {
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hi ${firstName},</p>
    <p style="margin:0 0 16px; color:#475569;">We received a request to reset your password. Click the button below to choose a new password.</p>
    ${Button({ label: "Reset Password", url: resetUrl })}
    ${Divider()}
    <p style="margin:0 0 8px;">This link expires in ${expirationText}.</p>
    <p style="margin:0; color:#64748b;">If you did not request a password reset, please ignore this email or contact support.</p>
  `;

  return buildAuthTemplate({
    title: "Reset Your Password",
    bodyHtml,
    previewText: "Reset your password using the link inside.",
  });
};

export const buildPasswordResetSuccessEmailTemplate = ({ firstName }) => {
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hi ${firstName},</p>
    <p style="margin:0 0 16px; color:#475569;">Your password was reset successfully. If you did not make this change, please contact support immediately.</p>
    ${Divider()}
    <p style="margin:0; color:#64748b;">We recommend signing in and reviewing your security settings.</p>
  `;

  return buildAuthTemplate({
    title: "Password Reset Successfully",
    bodyHtml,
    previewText: "Your password reset is complete.",
  });
};

export const buildPasswordChangedEmailTemplate = ({ firstName, changedTime }) => {
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hi ${firstName},</p>
    <p style="margin:0 0 16px; color:#475569;">Your password was changed on ${changedTime}.</p>
    ${Divider()}
    <p style="margin:0 0 8px;">If you did not make this change, please contact support immediately.</p>
    <p style="margin:0; color:#64748b;">If you need help, our support team can assist you.</p>
  `;

  return buildAuthTemplate({
    title: "Your Password Has Been Changed",
    bodyHtml,
    previewText: "Your password was changed successfully.",
  });
};

const buildMarketplaceTemplate = ({ title, bodyHtml, previewText }) =>
  createBaseTemplate({ title, bodyHtml, previewText });

export const buildOrderConfirmationTemplate = ({ firstName, listingTitle, amount, orderUrl }) => {
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hi ${firstName},</p>
    <p style="margin:0 0 16px; color:#475569;">Your order for "${listingTitle}" has been confirmed for $${amount}. We are processing it now.</p>
    ${Button({ label: "View order", url: orderUrl })}
    ${Divider()}
    <p style="margin:0; color:#64748b;">If you have questions, visit your dashboard or contact support.</p>
  `;

  return buildMarketplaceTemplate({
    title: "Order confirmed",
    bodyHtml,
    previewText: "Your order has been confirmed.",
  });
};

export const buildNewOrderTemplate = ({ firstName, listingTitle, amount, buyerName, orderUrl }) => {
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hi ${firstName},</p>
    <p style="margin:0 0 16px; color:#475569;">A new order was placed for "${listingTitle}" by ${buyerName}. The total is $${amount}.</p>
    ${Button({ label: "View order", url: orderUrl })}
    ${Divider()}
    <p style="margin:0; color:#64748b;">Start working on the order right away to keep your buyer satisfied.</p>
  `;

  return buildMarketplaceTemplate({
    title: "New order received",
    bodyHtml,
    previewText: "A buyer placed a new order.",
  });
};

export const buildOrderAcceptedTemplate = ({ firstName, sellerName, orderUrl }) => {
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hi ${firstName},</p>
    <p style="margin:0 0 16px; color:#475569;">${sellerName} has accepted your order and will begin work shortly.</p>
    ${Button({ label: "View order", url: orderUrl })}
    ${Divider()}
    <p style="margin:0; color:#64748b;">You will receive another update when the order is delivered.</p>
  `;

  return buildMarketplaceTemplate({
    title: "Your order was accepted",
    bodyHtml,
    previewText: "Seller accepted your order.",
  });
};

export const buildOrderDeliveredTemplate = ({ firstName, sellerName, orderUrl }) => {
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hi ${firstName},</p>
    <p style="margin:0 0 16px; color:#475569;">${sellerName} has delivered your order. Review the submission and approve it when ready.</p>
    ${Button({ label: "View order", url: orderUrl })}
    ${Divider()}
    <p style="margin:0; color:#64748b;">If you need changes, request a revision from the order page.</p>
  `;

  return buildMarketplaceTemplate({
    title: "Your order has been delivered",
    bodyHtml,
    previewText: "Seller delivered your order.",
  });
};

export const buildCancellationRequestedTemplate = ({ firstName, buyerName, orderUrl }) => {
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hi ${firstName},</p>
    <p style="margin:0 0 16px; color:#475569;">${buyerName} requested a cancellation for the order. Please review the request and respond.</p>
    ${Button({ label: "View order", url: orderUrl })}
    ${Divider()}
    <p style="margin:0; color:#64748b;">If you agree with the cancellation, approve it from the order page.</p>
  `;

  return buildMarketplaceTemplate({
    title: "Cancellation requested",
    bodyHtml,
    previewText: "A buyer requested cancellation.",
  });
};

export const buildCancellationApprovedTemplate = ({ firstName, orderUrl }) => {
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hi ${firstName},</p>
    <p style="margin:0 0 16px; color:#475569;">Your cancellation request has been approved and the order has been cancelled.</p>
    ${Button({ label: "View order", url: orderUrl })}
    ${Divider()}
    <p style="margin:0; color:#64748b;">Refunds will be processed automatically if applicable.</p>
  `;

  return buildMarketplaceTemplate({
    title: "Cancellation approved",
    bodyHtml,
    previewText: "Your cancellation request was approved.",
  });
};

export const buildCancellationRejectedTemplate = ({ firstName, orderUrl }) => {
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hi ${firstName},</p>
    <p style="margin:0 0 16px; color:#475569;">Your cancellation request was rejected. The order will continue as planned.</p>
    ${Button({ label: "View order", url: orderUrl })}
    ${Divider()}
    <p style="margin:0; color:#64748b;">If you have questions, reach out to support or continue the order in the chat.</p>
  `;

  return buildMarketplaceTemplate({
    title: "Cancellation rejected",
    bodyHtml,
    previewText: "Your cancellation request was rejected.",
  });
};

export const buildRefundApprovedTemplate = ({ firstName, orderUrl }) => {
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hi ${firstName},</p>
    <p style="margin:0 0 16px; color:#475569;">Your refund request has been approved. The order has been refunded.</p>
    ${Button({ label: "View order", url: orderUrl })}
    ${Divider()}
    <p style="margin:0; color:#64748b;">If you have questions, contact support.</p>
  `;

  return buildMarketplaceTemplate({
    title: "Refund approved",
    bodyHtml,
    previewText: "Your refund request was approved.",
  });
};

export const buildRefundRejectedTemplate = ({ firstName, orderUrl }) => {
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hi ${firstName},</p>
    <p style="margin:0 0 16px; color:#475569;">Your refund request has been rejected. The order will continue as planned.</p>
    ${Button({ label: "View order", url: orderUrl })}
    ${Divider()}
    <p style="margin:0; color:#64748b;">If you have questions, contact support or review the order details.</p>
  `;

  return buildMarketplaceTemplate({
    title: "Refund rejected",
    bodyHtml,
    previewText: "Your refund request was rejected.",
  });
};
export const buildSellerApplicationSubmittedTemplate = ({ firstName, applicationUrl, reviewTimeText }) => {
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hi ${firstName},</p>
    <p style="margin:0 0 16px; color:#475569;">Your seller application has been received. Our team is reviewing your submission and will respond ${reviewTimeText}.</p>
    ${Button({ label: "View application", url: applicationUrl })}
    ${Divider()}
    <p style="margin:0; color:#64748b;">No action is needed from you right now. We’ll notify you if we require additional information.</p>
  `;

  return buildMarketplaceTemplate({
    title: "Seller application received",
    bodyHtml,
    previewText: "We received your seller application.",
  });
};

export const buildSellerApplicationApprovedTemplate = ({ firstName, sellerDashboardUrl }) => {
  const bodyHtml = `
    <p style="margin:0 0 12px;">Congratulations ${firstName},</p>
    <p style="margin:0 0 16px; color:#475569;">Your seller application has been approved and your seller account is now active.</p>
    ${Button({ label: "Go to seller dashboard", url: sellerDashboardUrl })}
    ${Divider()}
    <p style="margin:0; color:#64748b;">You can now start creating listings and serving buyers.</p>
  `;

  return buildMarketplaceTemplate({
    title: "Seller application approved",
    bodyHtml,
    previewText: "Your seller account is now active.",
  });
};

export const buildSellerApplicationRejectedTemplate = ({ firstName, reason, resubmitUrl }) => {
  const reasonHtml = reason ? `<p style="margin:0 0 12px; color:#475569;">Reason: ${reason}</p>` : "";
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hi ${firstName},</p>
    <p style="margin:0 0 16px; color:#475569;">We reviewed your seller application and, unfortunately, it was not approved.</p>
    ${reasonHtml}
    ${Button({ label: "Submit again", url: resubmitUrl })}
    ${Divider()}
    <p style="margin:0; color:#64748b;">If you’d like to try again, please update your application and resubmit.</p>
  `;

  return buildMarketplaceTemplate({
    title: "Seller application update needed",
    bodyHtml,
    previewText: "Your seller application was not approved.",
  });
};

export const buildNewSellerApplicationAdminTemplate = ({ applicantName, applicationUrl, submittedAt }) => {
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hello,</p>
    <p style="margin:0 0 16px; color:#475569;">A new seller application was submitted by ${applicantName} on ${submittedAt}.</p>
    ${Button({ label: "Review application", url: applicationUrl })}
    ${Divider()}
    <p style="margin:0; color:#64748b;">Review the submission and update the application status in the admin panel.</p>
  `;

  return buildMarketplaceTemplate({
    title: "New seller application received",
    bodyHtml,
    previewText: "A new seller application is ready for review.",
  });
};

export const buildSellerApplicationResubmittedAdminTemplate = ({ applicantName, applicationUrl, resubmittedAt }) => {
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hello,</p>
    <p style="margin:0 0 16px; color:#475569;">${applicantName} has resubmitted their seller application on ${resubmittedAt}.</p>
    ${Button({ label: "Review application", url: applicationUrl })}
    ${Divider()}
    <p style="margin:0; color:#64748b;">Please review the updated application and continue the approval workflow.</p>
  `;

  return buildMarketplaceTemplate({
    title: "Seller application resubmitted",
    bodyHtml,
    previewText: "A seller application has been resubmitted.",
  });
};
export const buildRefundDecisionTemplate = ({ firstName, decision, orderUrl }) => {
  const decisionText = decision === "approved" ? "approved" : "rejected";
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hi ${firstName},</p>
    <p style="margin:0 0 16px; color:#475569;">A refund request for the order has been ${decisionText} by admin.</p>
    ${Button({ label: "View order", url: orderUrl })}
    ${Divider()}
    <p style="margin:0; color:#64748b;">Review the order details to see the current status.</p>
  `;

  return buildMarketplaceTemplate({
    title: `Refund ${decisionText}`,
    bodyHtml,
    previewText: `A refund was ${decisionText}.`,
  });
};

export const buildDisputeOpenedTemplate = ({ firstName, openerRole, orderUrl }) => {
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hi ${firstName},</p>
    <p style="margin:0 0 16px; color:#475569;">A dispute was opened for your order by the ${openerRole}. Please review the issue.</p>
    ${Button({ label: "View order", url: orderUrl })}
    ${Divider()}
    <p style="margin:0; color:#64748b;">Respond promptly to keep the dispute moving forward.</p>
  `;

  return buildMarketplaceTemplate({
    title: "Dispute opened",
    bodyHtml,
    previewText: "A dispute was opened for your order.",
  });
};

export const buildDisputeResolvedTemplate = ({ firstName, decision, orderUrl }) => {
  const decisionText = decision === "buyer_wins" ? "buyer wins" : "seller wins";
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hi ${firstName},</p>
    <p style="margin:0 0 16px; color:#475569;">The dispute has been resolved. ${decisionText.replace("_", " ")}.</p>
    ${Button({ label: "View order", url: orderUrl })}
    ${Divider()}
    <p style="margin:0; color:#64748b;">Visit the order for details about the decision.</p>
  `;

  return buildMarketplaceTemplate({
    title: "Dispute resolved",
    bodyHtml,
    previewText: "A dispute has been resolved.",
  });
};

export const buildNewMessageTemplate = ({ firstName, messagePreview, conversationUrl }) => {
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hi ${firstName},</p>
    <p style="margin:0 0 16px; color:#475569;">You received a new message:</p>
    <p style="margin:0 0 16px; color:#0f172a; font-weight:600;">${messagePreview}</p>
    ${Button({ label: "View conversation", url: conversationUrl })}
    ${Divider()}
    <p style="margin:0; color:#64748b;">Respond quickly to keep the order moving forward.</p>
  `;

  return buildMarketplaceTemplate({
    title: "New message received",
    bodyHtml,
    previewText: "You have a new marketplace message.",
  });
};

export const buildRevisionRequestedTemplate = ({ firstName, buyerName, orderUrl }) => {
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hi ${firstName},</p>
    <p style="margin:0 0 16px; color:#475569;">${buyerName} requested a revision for your delivery. Please review the request.</p>
    ${Button({ label: "View order", url: orderUrl })}
    ${Divider()}
    <p style="margin:0; color:#64748b;">Complete the revision as soon as possible to keep your buyer satisfied.</p>
  `;

  return buildMarketplaceTemplate({
    title: "Revision requested",
    bodyHtml,
    previewText: "A buyer requested a revision.",
  });
};

export const buildReviewReceivedTemplate = ({ firstName, buyerName, orderUrl }) => {
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hi ${firstName},</p>
    <p style="margin:0 0 16px; color:#475569;">${buyerName} left a review for your completed order.</p>
    ${Button({ label: "View order", url: orderUrl })}
    ${Divider()}
    <p style="margin:0; color:#64748b;">Reviews help build your reputation on the marketplace.</p>
  `;

  return buildMarketplaceTemplate({
    title: "New review received",
    bodyHtml,
    previewText: "You received a new review.",
  });
};

export const buildAdminRefundRequestedTemplate = ({ buyerName, orderUrl }) => {
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hello,</p>
    <p style="margin:0 0 16px; color:#475569;">A refund was requested by ${buyerName} for an order. Review the request and take action.</p>
    ${Button({ label: "View order", url: orderUrl })}
    ${Divider()}
    <p style="margin:0; color:#64748b;">This request was submitted through the marketplace refund workflow.</p>
  `;

  return buildMarketplaceTemplate({
    title: "Refund requested",
    bodyHtml,
    previewText: "A refund request requires admin attention.",
  });
};

export const buildAdminCancellationRequestedTemplate = ({ buyerName, orderUrl }) => {
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hello,</p>
    <p style="margin:0 0 16px; color:#475569;">A cancellation was requested by ${buyerName} for an order. Review the request and decide.</p>
    ${Button({ label: "Review cancellation", url: orderUrl })}
    ${Divider()}
    <p style="margin:0; color:#64748b;">This request needs admin review before the order can be resolved.</p>
  `;

  return buildMarketplaceTemplate({
    title: "Cancellation requested",
    bodyHtml,
    previewText: "A cancellation request requires admin attention.",
  });
};

export const buildAdminDisputeOpenedTemplate = ({ openerRole, orderUrl }) => {
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hello,</p>
    <p style="margin:0 0 16px; color:#475569;">A dispute was opened by the ${openerRole}. Please review the dispute and resolve it.</p>
    ${Button({ label: "Review dispute", url: orderUrl })}
    ${Divider()}
    <p style="margin:0; color:#64748b;">Admin action is required to resolve this dispute.</p>
  `;

  return buildMarketplaceTemplate({
    title: "Dispute opened",
    bodyHtml,
    previewText: "A dispute requires admin review.",
  });
};
