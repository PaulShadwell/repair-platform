import nodemailer from "nodemailer";
import { config } from "../config.js";

const isEnabled = Boolean(config.smtpHost && config.smtpFrom);

const transport = isEnabled
  ? nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth:
        config.smtpUser && config.smtpPass
          ? {
              user: config.smtpUser,
              pass: config.smtpPass,
            }
          : undefined,
    })
  : null;

export function isMailerConfigured(): boolean {
  return Boolean(transport);
}

export async function sendPasswordResetEmail(
  toEmail: string,
  username: string,
  resetToken: string,
): Promise<void> {
  if (!transport) {
    throw new Error("SMTP is not configured");
  }

  const resetLink = `${config.publicBaseUrl}/?resetToken=${encodeURIComponent(resetToken)}`;
  await transport.sendMail({
    from: config.smtpFrom,
    to: toEmail,
    subject: "Repair Platform password reset",
    text: `Hello ${username},

We received a request to reset your password.

Open this link to continue:
${resetLink}

Or enter this token in the app:
${resetToken}

This token expires in 30 minutes.
If you did not request this, you can ignore this email.`,
  });
}
