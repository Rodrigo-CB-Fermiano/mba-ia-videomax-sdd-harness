"use client";

interface ProgressBarProps {
  filename: string;
  percentage: number;
  speedBps: number;
  etaSeconds: number;
  onCancel: () => void;
}

function formatSpeed(bps: number): string {
  if (bps >= 1_048_576) return `${(bps / 1_048_576).toFixed(1)} MB/s`;
  if (bps >= 1_024) return `${(bps / 1_024).toFixed(0)} KB/s`;
  return `${bps} B/s`;
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)} segundos restantes`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `${minutes}m ${secs}s restantes`;
}

export function ProgressBar({
  filename,
  percentage,
  speedBps,
  etaSeconds,
  onCancel,
}: ProgressBarProps) {
  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 truncate max-w-xs">
          {filename}
        </span>
        <span className="text-sm text-gray-500">{Math.round(percentage)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500 space-x-2">
          <span>{formatSpeed(speedBps)}</span>
          <span>·</span>
          <span>{etaSeconds > 0 ? formatEta(etaSeconds) : "Calculando..."}</span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-red-600 hover:text-red-800 font-medium"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
