"use client";

interface QuotaIndicatorProps {
  usedBytes: number;
  maxBytes: number;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export function QuotaIndicator({ usedBytes, maxBytes }: QuotaIndicatorProps) {
  const percent = Math.min(100, (usedBytes / maxBytes) * 100);
  const isNearFull = percent >= 90;

  return (
    <div className="w-full">
      <div className="flex justify-between text-sm text-gray-600 mb-1">
        <span>{formatBytes(usedBytes)} usados de {formatBytes(maxBytes)}</span>
        <span>{percent.toFixed(0)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${
            isNearFull ? "bg-red-500" : "bg-blue-500"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {isNearFull && (
        <p className="text-xs text-red-500 mt-1">
          Armazenamento quase cheio. Exclua vídeos para liberar espaço.
        </p>
      )}
    </div>
  );
}
