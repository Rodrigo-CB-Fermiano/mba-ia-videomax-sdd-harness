import { redirect } from "next/navigation";
import { getQuota } from "@/server/upload/actions";
import { QuotaIndicator } from "@/components/upload/QuotaIndicator";
import { UploadClient } from "./UploadClient";

export default async function UploadPage() {
  let quota: { usedBytes: number; maxBytes: number };
  try {
    quota = await getQuota();
  } catch {
    redirect("/login");
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Enviar vídeo</h1>
        <p className="text-sm text-gray-500 mt-1">
          Faça upload do seu vídeo para iniciar a transcrição automática.
        </p>
      </div>

      <QuotaIndicator usedBytes={quota.usedBytes} maxBytes={quota.maxBytes} />

      <UploadClient usedBytes={quota.usedBytes} maxBytes={quota.maxBytes} />
    </div>
  );
}
