import { db } from "@/lib/db";
import nodemailer from "nodemailer";
import { randomUUID } from "crypto";

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_WINDOW_MINUTES = 15;

export async function checkLockout(
  email: string
): Promise<{ locked: boolean }> {
  const windowStart = new Date(
    Date.now() - LOCKOUT_WINDOW_MINUTES * 60 * 1000
  );

  const count = await db.loginAttempt.count({
    where: {
      email,
      attemptedAt: { gte: windowStart },
    },
  });

  return { locked: count >= LOCKOUT_THRESHOLD };
}

export async function recordFailedAttempt(
  email: string,
  userId?: string
): Promise<void> {
  await db.loginAttempt.create({
    data: { email, userId },
  });
}

export async function clearAttempts(email: string): Promise<void> {
  await db.loginAttempt.deleteMany({ where: { email } });
}

export async function generateResetToken(email: string): Promise<string> {
  const token = randomUUID();
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.verificationToken.deleteMany({ where: { identifier: email } });

  await db.verificationToken.create({
    data: { identifier: email, token, expires },
  });

  return token;
}

export async function validateResetToken(
  token: string
): Promise<{ valid: boolean; email?: string }> {
  const record = await db.verificationToken.findUnique({
    where: { token },
  });

  if (!record) return { valid: false };
  if (record.expires < new Date()) return { valid: false };

  return { valid: true, email: record.identifier };
}

export async function consumeResetToken(token: string): Promise<void> {
  await db.verificationToken.delete({ where: { token } });
}

export async function sendResetEmail(
  email: string,
  token: string
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "localhost",
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: false,
  });

  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password/confirm?token=${token}`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM ?? "noreply@videomax.local",
    to: email,
    subject: "Redefinição de senha — VideoMax",
    html: `
      <p>Clique no link abaixo para redefinir sua senha. O link expira em 1 hora.</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>Se você não solicitou a redefinição, ignore este email.</p>
    `,
  });
}
