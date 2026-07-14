import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { SocialButtons } from "@/components/auth/SocialButtons";

export default function LoginPage() {
  return (
    <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">VideoMax</h1>
        <p className="mt-1 text-sm text-gray-500">Entre na sua conta</p>
      </div>

      <SocialButtons />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-400">ou</span>
        </div>
      </div>

      <LoginForm />

      <div className="text-center space-y-2">
        <Link
          href="/reset-password"
          className="block text-sm text-blue-600 hover:underline"
        >
          Esqueci minha senha
        </Link>
        <p className="text-sm text-gray-500">
          Não tem conta?{" "}
          <Link href="/register" className="text-blue-600 hover:underline">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
