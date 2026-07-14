import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 space-y-6">
      <div className="text-center">
        <h1 className="text-xl font-bold text-gray-900">Recuperar senha</h1>
        <p className="mt-1 text-sm text-gray-500">
          Informe seu email para receber o link de recuperação
        </p>
      </div>

      <ResetPasswordForm />

      <p className="text-center text-sm text-gray-500">
        <Link href="/login" className="text-blue-600 hover:underline">
          Voltar para o login
        </Link>
      </p>
    </div>
  );
}
