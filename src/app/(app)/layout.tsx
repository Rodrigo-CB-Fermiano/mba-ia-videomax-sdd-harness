import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        <span className="text-lg font-bold text-gray-900">VideoMax</span>
        <div className="flex-1 max-w-xl">
          <input
            type="search"
            placeholder="Buscar vídeos..."
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
            {session.user.name?.[0]?.toUpperCase() ?? "U"}
          </div>
        </div>
      </header>
      <main className="p-6">{children}</main>

      <Link
        href="/upload"
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl transition-colors"
        title="Enviar vídeo"
        aria-label="Enviar vídeo"
      >
        ＋
      </Link>
    </div>
  );
}
