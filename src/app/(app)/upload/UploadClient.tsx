"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { UploadZone } from "@/components/upload/UploadZone";

interface UploadClientProps {
  usedBytes: number;
  maxBytes: number;
}

export function UploadClient({ usedBytes, maxBytes }: UploadClientProps) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);

  const handleComplete = useCallback(
    (_videoId: string) => {
      setToast("Upload concluído. Processamento iniciado.");
      setTimeout(() => {
        router.push("/library");
        router.refresh();
      }, 1500);
    },
    [router]
  );

  const handleError = useCallback((_msg: string) => {}, []);
  const handleCancel = useCallback(() => {}, []);

  return (
    <div>
      {toast && (
        <div className="mb-4 px-4 py-3 bg-green-100 text-green-800 rounded-lg text-sm font-medium">
          {toast}
        </div>
      )}
      <UploadZone
        usedBytes={usedBytes}
        maxBytes={maxBytes}
        onComplete={handleComplete}
        onError={handleError}
        onCancel={handleCancel}
      />
    </div>
  );
}
