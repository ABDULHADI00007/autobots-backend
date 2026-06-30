import crypto from "crypto";
import User from "../users/user.model.js";
import generateToken from "../../utils/generateToken.js";
import hashPassword from "../../utils/hashPassword.js";
import comparePassword from "../../utils/comparePassword.js";
import {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendVerificationSuccessEmail,
  sendForgotPasswordEmail,
  sendPasswordResetSuccessEmail,
  sendPasswordChangedEmail,
} from "../email/auth.email.js";

const createToken = () => crypto.randomBytes(32).toString("hex");
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

export const registerUser = async ({ name, email, password, role = "buyer" }) => {
  const normalizedEmail = email.toLowerCase();

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new Error("Email already exists");
  }

  const hashedPasswordValue = await hashPassword(password);
  const verificationToken = createToken();
  const verificationTokenHash = hashToken(verificationToken);
  const verificationExpires = Date.now() + 24 * 60 * 60 * 1000;

  const user = await User.create({
    name,
    email: normalizedEmail,
    password: hashedPasswordValue,
    role,
    emailVerified: false,
    emailVerificationToken: verificationTokenHash,
    emailVerificationExpires: verificationExpires,
  });

  const token = generateToken(user);

  const welcomeResult = await sendWelcomeEmail({ email: user.email, name: user.name });
  console.log("AUTH EMAIL: Welcome result", {
    email: user.email,
    messageId: welcomeResult?.id || null,
    success: Boolean(welcomeResult),
  });

  const verificationResult = await sendVerificationEmail({ email: user.email, name: user.name, token: verificationToken });
  console.log("AUTH EMAIL: Verification result", {
    email: user.email,
    messageId: verificationResult?.id || null,
    success: Boolean(verificationResult),
  });

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
    token,
  };
};

export const loginUser = async ({ email, password }) => {
  const normalizedEmail = email.toLowerCase();

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw new Error("Invalid email or password");
  }

  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    throw new Error("Invalid email or password");
  }

  const token = generateToken(user);

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
    token,
  };
};

export const verifyEmailToken = async (token) => {
  const tokenHash = hashToken(token);
  const user = await User.findOne({
    emailVerificationToken: tokenHash,
    emailVerificationExpires: { $gt: new Date() },
  });

  if (!user) {
    throw new Error("Invalid or expired verification token");
  }

  user.emailVerified = true;
  user.emailVerifiedAt = new Date();
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  try {
    await sendVerificationSuccessEmail({ email: user.email, name: user.name });
  } catch (error) {
    console.error("Verification success email failed", { email: user.email, error: error.message || "Unknown" });
  }

  return user;
};

export const requestPasswordReset = async (email) => {
  const normalizedEmail = email.toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    return;
  }

  const resetToken = createToken();
  const resetTokenHash = hashToken(resetToken);
  const resetExpires = Date.now() + 60 * 60 * 1000;

  user.passwordResetToken = resetTokenHash;
  user.passwordResetExpires = resetExpires;
  await user.save();

  try {
    await sendForgotPasswordEmail({ email: user.email, name: user.name, token: resetToken });
  } catch (error) {
    console.error("Forgot password email failed", { email: user.email, error: error.message || "Unknown" });
  }
};

export const resetPassword = async (token, password) => {
  const tokenHash = hashToken(token);
  const user = await User.findOne({
    passwordResetToken: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  });

  if (!user) {
    throw new Error("Invalid or expired password reset token");
  }

  user.password = await hashPassword(password);
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  try {
    await sendPasswordResetSuccessEmail({ email: user.email, name: user.name });
  } catch (error) {
    console.error("Password reset success email failed", { email: user.email, error: error.message || "Unknown" });
  }
};

export const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const isPasswordValid = await comparePassword(currentPassword, user.password);
  if (!isPasswordValid) {
    throw new Error("Current password is incorrect");
  }

  user.password = await hashPassword(newPassword);
  await user.save();

  try {
    await sendPasswordChangedEmail({ email: user.email, name: user.name, changedAt: new Date() });
  } catch (error) {
    console.error("Password changed email failed", { email: user.email, error: error.message || "Unknown" });
  }
};

export const getCurrentUser = async (userId) => {
  const user = await User.findById(userId).select("-password");
  if (!user) {
    throw new Error("User not found");
  }

  return user;
};
