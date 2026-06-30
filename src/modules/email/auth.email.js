import { sendEmail } from "./email.service.js";
import {
  buildForgotPasswordEmailTemplate,
  buildPasswordChangedEmailTemplate,
  buildPasswordResetSuccessEmailTemplate,
  buildVerificationEmailTemplate,
  buildVerificationSuccessEmailTemplate,
  buildWelcomeEmailTemplate,
} from "./email.templates.js";
import { env } from "../../config/env.js";

const getFirstName = (name = "") => {
  const trimmed = String(name).trim();
  if (!trimmed) return "there";
  return trimmed.split(" ")[0];
};

const normalizeUrl = (url) => url.replace(/\/+$/, "");

const getDashboardUrl = () => `${normalizeUrl(env.FRONTEND_URL)}/dashboard`;
const getVerifyEmailUrl = (token) => `${normalizeUrl(env.FRONTEND_URL)}/verify-email?token=${token}`;
const getResetPasswordUrl = (token) => `${normalizeUrl(env.FRONTEND_URL)}/reset-password?token=${token}`;

const sendAuthEmail = async ({ recipient, subject, html, text, emailType }) => {
  try {
    const result = await sendEmail({ recipient, subject, html, text });
    console.log("Auth email sent", { emailType, recipient, messageId: result?.id || null, success: Boolean(result) });
    return result;
  } catch (error) {
    console.error("Auth email failed", { emailType, recipient, error: error.message || "Unknown" });
    return null;
  }
};

export const sendWelcomeEmail = async ({ email, name }) => {
  const firstName = getFirstName(name);
  const html = buildWelcomeEmailTemplate({ firstName, dashboardUrl: getDashboardUrl() });
  const text = `Welcome ${firstName}!\n\nWelcome to the marketplace. Visit your dashboard: ${getDashboardUrl()}`;

  return sendAuthEmail({
    recipient: email,
    subject: "Welcome to Marketplace",
    html,
    text,
    emailType: "welcome",
  });
};

export const sendVerificationEmail = async ({ email, name, token }) => {
  const firstName = getFirstName(name);
  const verificationUrl = getVerifyEmailUrl(token);
  const html = buildVerificationEmailTemplate({ firstName, verificationUrl, expirationText: "24 hours" });
  const text = `Hello ${firstName},\n\nVerify your email: ${verificationUrl}\nThis link expires in 24 hours.`;

  return sendAuthEmail({
    recipient: email,
    subject: "Verify your email",
    html,
    text,
    emailType: "verification",
  });
};

export const sendVerificationSuccessEmail = async ({ email, name }) => {
  const firstName = getFirstName(name);
  const html = buildVerificationSuccessEmailTemplate({ firstName });
  const text = `Hi ${firstName},\n\nYour email has been verified successfully.`;

  return sendAuthEmail({
    recipient: email,
    subject: "Email verified successfully",
    html,
    text,
    emailType: "verification_success",
  });
};

export const sendForgotPasswordEmail = async ({ email, name, token }) => {
  const firstName = getFirstName(name);
  const resetUrl = getResetPasswordUrl(token);
  const html = buildForgotPasswordEmailTemplate({ firstName, resetUrl, expirationText: "1 hour" });
  const text = `Hi ${firstName},\n\nReset your password: ${resetUrl}\nThis link expires in 1 hour.`;

  return sendAuthEmail({
    recipient: email,
    subject: "Reset your password",
    html,
    text,
    emailType: "forgot_password",
  });
};

export const sendPasswordResetSuccessEmail = async ({ email, name }) => {
  const firstName = getFirstName(name);
  const html = buildPasswordResetSuccessEmailTemplate({ firstName });
  const text = `Hi ${firstName},\n\nYour password has been reset successfully.`;

  return sendAuthEmail({
    recipient: email,
    subject: "Your password has been reset",
    html,
    text,
    emailType: "password_reset_success",
  });
};

export const sendPasswordChangedEmail = async ({ email, name, changedAt }) => {
  const firstName = getFirstName(name);
  const changedTime = new Date(changedAt).toLocaleString();
  const html = buildPasswordChangedEmailTemplate({ firstName, changedTime });
  const text = `Hi ${firstName},\n\nYour password was changed on ${changedTime}. If you did not make this change, contact support.`;

  return sendAuthEmail({
    recipient: email,
    subject: "Your password was changed",
    html,
    text,
    emailType: "password_changed",
  });
};
