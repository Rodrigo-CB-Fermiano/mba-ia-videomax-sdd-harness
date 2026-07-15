"use client";

import { useRef, useState, useCallback } from "react";
import { ProgressBar } from "./ProgressBar";

const MAX_FILE_SIZE = 314_572_800; // 300 MB

interface UploadZoneProps {
  usedBytes: number;
  maxBytes: number;
  onComplete: (videoId: string) => void;
  onError: (message: string) => void;
  onCancel: () => void;
}

type UploadState =
  | { status: "idle" }
  | { status: "dragover" }
  | { status: "uploading"; filename: string; percentage: number; speedBps: number; etaSeconds: number; videoId?: string }
  | { status: "done" }
  | { status: "error"; message: string };

export function UploadZone({
  usedBytes,
  maxBytes,
  onComplete,
  onError,
  onCancel,
}: UploadZoneProps) {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const videoIdRef = useRef<string | null>(null);

  const validateFile = (file: File): string | null => {
    if (!file.type.startsWith("video/")) {
      return "Apenas arquivos de vídeo são aceitos.";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "Arquivo muito grande. O tamanho máximo permitido é 300 MB.";
    }
    const remaining = maxBytes - usedBytes;
    if (file.size > remaining) {
      const remainingMB = Math.floor(remaining / 1_048_576);
      return `Armazenamento insuficiente. Você tem ${remainingMB} MB restantes. Delete vídeos para liberar espaço.`;
    }
    return null;
  };

  const startUpload = useCallback(
    (file: File) => {
      const error = validateFile(file);
      if (error) {
        setState({ status: "error", message: error });
        onError(error);
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      videoIdRef.current = null;

      let startTime = Date.now();
      let lastLoaded = 0;

      setState({
        status: "uploading",
        filename: file.name,
        percentage: 0,
        speedBps: 0,
        etaSeconds: 0,
      });

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const now = Date.now();
        const elapsed = (now - startTime) / 1000;
        const loaded = event.loaded;
        const speedBps = elapsed > 0 ? (loaded - lastLoaded) / ((now - startTime) / 1000) : 0;
        const remaining = event.total - loaded;
        const etaSeconds = speedBps > 0 ? remaining / speedBps : 0;
        const percentage = (loaded / event.total) * 100;

        lastLoaded = loaded;
        startTime = now;

        setState((prev) => ({
          ...prev,
          status: "uploading",
          filename: file.name,
          percentage,
          speedBps,
          etaSeconds,
        }));
      };

      xhr.onload = () => {
        if (xhr.status === 201) {
          try {
            const data = JSON.parse(xhr.responseText);
            videoIdRef.current = data.videoId;
            setState({ status: "done" });
            onComplete(data.videoId);
          } catch {
            const msg = "Upload falhou. Tente novamente em alguns instantes.";
            setState({ status: "error", message: msg });
            onError(msg);
          }
        } else {
          try {
            const data = JSON.parse(xhr.responseText);
            const msg =
              data.error === "QUOTA_EXCEEDED"
                ? `Armazenamento insuficiente. Você tem ${Math.floor(Number(data.remainingBytes) / 1_048_576)} MB restantes. Delete vídeos para liberar espaço.`
                : data.error === "FILE_TOO_LARGE"
                ? "Arquivo muito grande. O tamanho máximo permitido é 300 MB."
                : data.error === "INVALID_MIME"
                ? "Apenas arquivos de vídeo são aceitos."
                : "Upload falhou. Tente novamente em alguns instantes.";
            setState({ status: "error", message: msg });
            onError(msg);
          } catch {
            const msg = "Upload falhou. Tente novamente em alguns instantes.";
            setState({ status: "error", message: msg });
            onError(msg);
          }
        }
      };

      xhr.onerror = () => {
        const msg = "Upload interrompido. Verifique sua conexão e tente novamente.";
        setState({ status: "error", message: msg });
        onError(msg);
      };

      xhr.onabort = () => {
        setState({ status: "idle" });
      };

      xhr.open("POST", "/api/upload");
      xhr.send(formData);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [usedBytes, maxBytes, onComplete, onError]
  );

  const handleCancel = useCallback(async () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    const vid = videoIdRef.current;
    if (vid) {
      await fetch(`/api/upload/${vid}`, { method: "DELETE" });
      videoIdRef.current = null;
    }
    setState({ status: "idle" });
    onCancel();
  }, [onCancel]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) startUpload(file);
    },
    [startUpload]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) startUpload(file);
      e.target.value = "";
    },
    [startUpload]
  );

  return (
    <div className="w-full">
      {state.status === "uploading" ? (
        <ProgressBar
          filename={state.filename}
          percentage={state.percentage}
          speedBps={state.speedBps}
          etaSeconds={state.etaSeconds}
          onCancel={handleCancel}
        />
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setState({ status: "dragover" });
          }}
          onDragLeave={() => setState({ status: "idle" })}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
            state.status === "dragover"
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
          }`}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleChange}
          />
          <div className="space-y-2">
            <div className="text-4xl">🎬</div>
            <p className="text-base font-medium text-gray-700">
              Arraste um vídeo aqui ou{" "}
              <span className="text-blue-600 underline">escolha um arquivo</span>
            </p>
            <p className="text-sm text-gray-400">
              Todos os formatos de vídeo · Máximo 300 MB por arquivo
            </p>
          </div>
        </div>
      )}

      {state.status === "error" && (
        <p className="mt-3 text-sm text-red-600">{state.message}</p>
      )}
    </div>
  );
}
