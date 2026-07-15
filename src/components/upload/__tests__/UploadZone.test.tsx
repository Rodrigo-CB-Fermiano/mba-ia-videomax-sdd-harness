import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { UploadZone } from "../UploadZone";

const MB = 1_048_576;
const GB = 1_073_741_824;

const defaultProps = {
  usedBytes: 0,
  maxBytes: GB,
  onComplete: vi.fn(),
  onError: vi.fn(),
  onCancel: vi.fn(),
};

// Mock XMLHttpRequest
class MockXHR {
  upload = { onprogress: null as ((e: ProgressEvent) => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 201;
  responseText = JSON.stringify({ videoId: "vid-123", originalFilename: "test.mp4", fileSizeBytes: "1024", uploadedAt: new Date().toISOString() });
  openArgs: string[] = [];
  sent = false;
  aborted = false;

  open(...args: string[]) { this.openArgs = args; }
  send(_data: FormData) { this.sent = true; }
  abort() { this.aborted = true; this.onabort?.(); }
}

let mockXhr: MockXHR;

beforeEach(() => {
  vi.clearAllMocks();
  mockXhr = new MockXHR();
  // @ts-expect-error: mocking global
  global.XMLHttpRequest = vi.fn(() => mockXhr);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function createVideoFile(sizeMB: number = 1, type = "video/mp4") {
  const bytes = new Uint8Array(sizeMB * MB);
  return new File([bytes], "test.mp4", { type });
}

describe("UploadZone", () => {
  it("renderiza zona de drop no estado idle", () => {
    render(<UploadZone {...defaultProps} />);
    expect(screen.getByText(/Arraste um vídeo aqui/)).toBeTruthy();
  });

  it("rejeita arquivo com MIME type inválido", () => {
    const onError = vi.fn();
    render(<UploadZone {...defaultProps} onError={onError} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array(1024)], "photo.png", { type: "image/png" });

    act(() => {
      Object.defineProperty(input, "files", {
        value: [file],
        configurable: true,
      });
      fireEvent.change(input);
    });

    expect(onError).toHaveBeenCalledWith(expect.stringContaining("vídeo"));
    expect(screen.getByText("Apenas arquivos de vídeo são aceitos.")).toBeTruthy();
  });

  it("rejeita arquivo maior que 300 MB", () => {
    const onError = vi.fn();
    render(<UploadZone {...defaultProps} onError={onError} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    // 301 MB
    const file = new File([new Uint8Array(1)], "big.mp4", { type: "video/mp4" });
    Object.defineProperty(file, "size", { value: 301 * MB, configurable: true });

    act(() => {
      Object.defineProperty(input, "files", {
        value: [file],
        configurable: true,
      });
      fireEvent.change(input);
    });

    expect(onError).toHaveBeenCalledWith(expect.stringContaining("300 MB"));
    expect(screen.getByText("Arquivo muito grande. O tamanho máximo permitido é 300 MB.")).toBeTruthy();
  });

  it("rejeita arquivo quando quota excedida", () => {
    const onError = vi.fn();
    render(
      <UploadZone
        {...defaultProps}
        usedBytes={950 * MB}
        maxBytes={GB}
        onError={onError}
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array(1)], "v.mp4", { type: "video/mp4" });
    Object.defineProperty(file, "size", { value: 100 * MB, configurable: true });

    act(() => {
      Object.defineProperty(input, "files", {
        value: [file],
        configurable: true,
      });
      fireEvent.change(input);
    });

    expect(onError).toHaveBeenCalledWith(expect.stringContaining("insuficiente"));
    expect(screen.getByText(/insuficiente/)).toBeTruthy();
  });

  it("inicia upload com XHR para arquivo válido", () => {
    render(<UploadZone {...defaultProps} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createVideoFile(1);

    act(() => {
      Object.defineProperty(input, "files", {
        value: [file],
        configurable: true,
      });
      fireEvent.change(input);
    });

    expect(mockXhr.sent).toBe(true);
    expect(mockXhr.openArgs[0]).toBe("POST");
    expect(mockXhr.openArgs[1]).toBe("/api/upload");
  });

  it("exibe ProgressBar durante upload", () => {
    render(<UploadZone {...defaultProps} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createVideoFile(1);

    act(() => {
      Object.defineProperty(input, "files", {
        value: [file],
        configurable: true,
      });
      fireEvent.change(input);
    });

    // ProgressBar rendered — cancel button present
    expect(screen.getByText("Cancelar")).toBeTruthy();
  });

  it("chama onComplete ao concluir upload com sucesso", () => {
    const onComplete = vi.fn();
    render(<UploadZone {...defaultProps} onComplete={onComplete} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createVideoFile(1);

    act(() => {
      Object.defineProperty(input, "files", {
        value: [file],
        configurable: true,
      });
      fireEvent.change(input);
    });

    act(() => {
      mockXhr.onload?.();
    });

    expect(onComplete).toHaveBeenCalledWith("vid-123");
  });

  it("aborta XHR ao clicar em Cancelar", () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });

    render(<UploadZone {...defaultProps} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createVideoFile(1);

    act(() => {
      Object.defineProperty(input, "files", {
        value: [file],
        configurable: true,
      });
      fireEvent.change(input);
    });

    act(() => {
      fireEvent.click(screen.getByText("Cancelar"));
    });

    expect(mockXhr.aborted).toBe(true);
  });
});
