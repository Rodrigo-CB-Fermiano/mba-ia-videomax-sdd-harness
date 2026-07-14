"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { resetPassword, setNewPassword } from "@/server/auth/actions";

const requestSchema = z.object({
  email: z.string().email("Email inválido"),
});

const confirmSchema = z.object({
  password: z
    .string()
    .min(8, "Senha deve ter ao menos 8 caracteres")
    .regex(/\d/, "Senha deve conter ao menos 1 número"),
});

type RequestValues = z.infer<typeof requestSchema>;
type ConfirmValues = z.infer<typeof confirmSchema>;

interface ResetPasswordFormProps {
  token?: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  if (token) {
    return <ConfirmForm token={token} />;
  }
  return <RequestForm />;
}

function RequestForm() {
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RequestValues>({ resolver: zodResolver(requestSchema) });

  function onSubmit(values: RequestValues) {
    const formData = new FormData();
    formData.set("email", values.email);

    startTransition(async () => {
      await resetPassword(formData);
      setSubmitted(true);
    });
  }

  if (submitted) {
    return (
      <p className="text-sm text-gray-600 text-center">
        Se o email estiver cadastrado, você receberá um link de recuperação em
        instantes.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          {...register("email")}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? "Enviando..." : "Enviar link de recuperação"}
      </button>
    </form>
  );
}

function ConfirmForm({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ConfirmValues>({ resolver: zodResolver(confirmSchema) });

  function onSubmit(values: ConfirmValues) {
    setError(null);
    const formData = new FormData();
    formData.set("token", token);
    formData.set("password", values.password);

    startTransition(async () => {
      const result = await setNewPassword(formData);
      if (result?.error === "TOKEN_INVALID") {
        setError("This link has expired. Request a new password reset.");
        return;
      }
      if (result?.error) {
        setError("Erro ao redefinir senha. Tente novamente.");
        return;
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
          Nova senha
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          {...register("password")}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.password && (
          <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? "Salvando..." : "Salvar nova senha"}
      </button>
    </form>
  );
}
