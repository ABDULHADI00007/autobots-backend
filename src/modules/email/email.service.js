import { env } from "../../config/env.js";
import { getEmailClient } from "./email.client.js";
import { normalizeEmailRecipients, normalizeAttachments, validateEmailAddress } from "./email.validation.js";
import { buildInfrastructureTestTemplate } from "./email.templates.js";

const getFromAddress = () => ({
  name: env.EMAIL_FROM_NAME,
  email: env.EMAIL_FROM_ADDRESS,
});

const formatRecipient = (recipient) => {
  if (typeof recipient === "string") {
    return validateEmailAddress(recipient);
  }

  if (recipient && typeof recipient === "object") {
    const email = recipient.email || recipient.address || "";
    const name = recipient.name ? String(recipient.name).trim() : "";
    return name ? `${name} <${validateEmailAddress(email)}>` : validateEmailAddress(email);
  }

  throw new Error("Invalid recipient format");
};

export const sendEmail = async ({
  recipient,
  subject,
  html,
  text,
  cc,
  bcc,
  replyTo,
  attachments,
}) => {
  if (!subject || typeof subject !== "string") {
    throw new Error("Email subject is required and must be a string");
  }

  if (!recipient) {
    throw new Error("Email recipient is required");
  }

  const from = getFromAddress();
  if (!from.name || !from.email) {
    throw new Error("Email sender name and address must be configured");
  }

  const payload = {
    from: `${from.name} <${from.email}>`,
    to: formatRecipient(recipient),
    subject,
    html,
    text,
  };

  if (cc) {
    payload.cc = normalizeEmailRecipients(cc);
  }

  if (bcc) {
    payload.bcc = normalizeEmailRecipients(bcc);
  }

  if (replyTo) {
    payload.reply_to = validateEmailAddress(replyTo);
  }

  if (attachments) {
    payload.attachments = normalizeAttachments(attachments);
  }

  const client = getEmailClient();

  console.log("EMAIL SERVICE START", {
    recipient: payload.to,
    subject: payload.subject,
  });
  console.log("EMAIL SERVICE: Before Resend API", { provider: "Resend", payload: { from: payload.from, to: payload.to, subject: payload.subject } });

  try {
    const response = await client.emails.send(payload);

    if (response.error) {
      const safeMessage = response.error.message || "Unknown email provider error";
      console.error("EMAIL SERVICE: Resend API returned error", {
        recipient: payload.to,
        subject: payload.subject,
        errorCode: response.error.name,
        failureReason: safeMessage,
      });
      throw new Error(`Email provider error: ${response.error.name} - ${safeMessage}`);
    }

    const result = response.data;
    const providerResponse = {
      messageId: result?.id || null,
      status: "queued",
    };

    console.log("EMAIL SERVICE: After Resend API", { providerResponse, headers: response.headers });
    console.log("EMAIL SERVICE: Success", {
      recipient: payload.to,
      subject: payload.subject,
      providerResponse,
    });

    return result;
  } catch (error) {
    const safeMessage = error?.message || "Unknown email provider error";
    console.error("EMAIL SERVICE: Failed", {
      recipient: payload.to,
      subject: payload.subject,
      failureReason: safeMessage,
    });
    throw new Error(`Email provider error: ${safeMessage}`);
  }
};

export const sendInternalTestEmail = async (recipient) => {
  return sendEmail({
    recipient,
    subject: "Autobots Marketplace Email Test",
    html: buildInfrastructureTestTemplate(),
    text: "This is an internal email infrastructure test for Autobots Marketplace.",
  });
};
