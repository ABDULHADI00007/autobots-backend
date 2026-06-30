const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateEmailAddress = (email) => {
  if (typeof email !== "string" || !email.trim()) {
    throw new Error(`Invalid email address: ${String(email)}`);
  }

  const normalized = email.trim();

  if (!EMAIL_PATTERN.test(normalized)) {
    throw new Error(`Invalid email address: ${normalized}`);
  }

  return normalized;
};

export const normalizeEmailRecipients = (recipients) => {
  if (!recipients) {
    return [];
  }

  if (typeof recipients === "string") {
    return [validateEmailAddress(recipients)];
  }

  if (Array.isArray(recipients)) {
    if (recipients.length === 0) {
      throw new Error("Email recipient list must not be empty");
    }

    return recipients.map(validateEmailAddress);
  }

  throw new Error("Email recipients must be a string or an array of strings");
};

export const normalizeAttachments = (attachments) => {
  if (!attachments) {
    return [];
  }

  if (!Array.isArray(attachments)) {
    throw new Error("Email attachments must be an array");
  }

  return attachments.map((attachment) => {
    if (!attachment || typeof attachment !== "object") {
      throw new Error("Invalid email attachment");
    }

    const { filename, content, type = "application/octet-stream", disposition = "attachment" } = attachment;

    if (!filename || !content) {
      throw new Error("Email attachment must include filename and content");
    }

    return {
      filename,
      content,
      type,
      disposition,
    };
  });
};
