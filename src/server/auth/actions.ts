"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { signIn } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  checkLockout,
  recordFailedAttempt,
  clearAttempts,
  generateResetToken,
  validateResetToken,
  consumeResetToken,
  sendResetEmail,
} from "@/server/auth/services";
import { AuthError } from "next-auth";

const registerSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  password: z
    .string()
    .min(8, "Senha deve ter ao menos 8 caracteres")
    .regex(/\d/, "Senha deve conter ao menos 1 número"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const resetPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
});

const setNewPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, "Senha deve ter ao menos 8 caracteres")
    .regex(/\d/, "Senha deve conter ao menos 1 número"),
});

export async function register(formData: FormData) {
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "VALIDATION", details: parsed.error.flatten() };
  }

  const { name, email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { error: "EMAIL_TAKEN" };

  const hashedPassword = await bcrypt.hash(password, 12);
  await db.user.create({ data: { name, email, password: hashedPassword } });

  return { success: true };
}

export async function loginAction(formData: FormData) {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { error: "VALIDATION" };

  const { email, password } = parsed.data;

  const lockout = await checkLockout(email);
  if (lockout.locked) return { error: "LOCKED" };

  const user = await db.user.findUnique({ where: { email } });
  if (!user?.password) {
    await recordFailedAttempt(email);
    return { error: "CREDENTIALS" };
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    await recordFailedAttempt(email, user.id);
    return { error: "CREDENTIALS" };
  }

  await clearAttempts(email);

  try {
    await signIn("credentials", { email, password, redirectTo: "/library" });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "CREDENTIALS" };
    }
    throw error;
  }
}

export async function resetPassword(formData: FormData) {
  const raw = { email: formData.get("email") };
  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) return { error: "VALIDATION" };

  const { email } = parsed.data;

  const user = await db.user.findUnique({ where: { email } });
  if (user) {
    const token = await generateResetToken(email);
    await sendResetEmail(email, token);
  }

  // Always return success — never reveal if email exists
  return { success: true };
}

export async function setNewPassword(formData: FormData) {
  const raw = {
    token: formData.get("token"),
    password: formData.get("password"),
  };

  const parsed = setNewPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "VALIDATION", details: parsed.error.flatten() };
  }

  const { token, password } = parsed.data;

  const result = await validateResetToken(token);
  if (!result.valid || !result.email) {
    return { error: "TOKEN_INVALID" };
  }

  const user = await db.user.findUnique({ where: { email: result.email } });
  if (!user) return { error: "TOKEN_INVALID" };

  const hashedPassword = await bcrypt.hash(password, 12);
  await db.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  await consumeResetToken(token);

  return { success: true };
}
