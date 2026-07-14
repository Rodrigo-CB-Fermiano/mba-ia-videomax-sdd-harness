import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

interface PageProps {
  searchParams: { token?: string };
}

export default function ResetPasswordConfirmPage({ searchParams }: PageProps) {
  const { token } = searchParams;

  if (!token) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center space-y-4">
        <p className="text-red-600 text-sm">
          This link has expired. Request a new password reset.
        </p>
        <Link href="/reset-password" className="text-blue-600 text-sm hover:underline">
          Solicitar novo link
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 space-y-6">
      <div className="text-center">
        <h1 className="text-xl font-bold text-gray-900">Nova senha</h1>
        <p className="mt-1 text-sm text-gray-500">
          Defina uma nova senha para sua conta
        </p>
      </div>

      <ResetPasswordForm token={token} />

      <p className="text-center text-sm text-gray-500">
        <Link href="/login" className="text-blue-600 hover:underline">
          Voltar para o login
        </Link>
      </p>
    </div>
  );
}
