import Link from "next/link";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { SocialButtons } from "@/components/auth/SocialButtons";

export default function RegisterPage() {
  return (
    <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">VideoMax</h1>
        <p className="mt-1 text-sm text-gray-500">Crie sua conta</p>
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

      <RegisterForm />

      <p className="text-center text-sm text-gray-500">
        Já tem conta?{" "}
        <Link href="/login" className="text-blue-600 hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
