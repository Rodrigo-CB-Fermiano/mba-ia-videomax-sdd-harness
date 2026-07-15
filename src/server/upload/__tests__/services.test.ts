import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

vi.mock("@/lib/db", () => ({
  db: {
    $executeRaw: vi.fn(),
  },
}));

// Import after mock
const { db } = await import("@/lib/db");
const mockDb = db as unknown as { $executeRaw: ReturnType<typeof vi.fn> };

import {
  generateStoredFilename,
  saveFileToDisk,
  deleteFileFromDisk,
  incrementQuota,
  decrementQuota,
} from "../services";

let tempDir: string;

beforeEach(() => {
  vi.clearAllMocks();
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "videomax-test-"));
  process.env.UPLOAD_DIR = tempDir;
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  delete process.env.UPLOAD_DIR;
});

describe("generateStoredFilename", () => {
  it("retorna UUID com extensão mp4 para video/mp4", () => {
    const name = generateStoredFilename("video/mp4");
    expect(name).toMatch(/^[0-9a-f-]{36}\.mp4$/);
  });

  it("retorna UUID com extensão webm para video/webm", () => {
    const name = generateStoredFilename("video/webm");
    expect(name).toMatch(/^[0-9a-f-]{36}\.webm$/);
  });

  it("extrai extensão do MIME desconhecido", () => {
    const name = generateStoredFilename("video/custom");
    expect(name).toMatch(/^[0-9a-f-]{36}\.custom$/);
  });
});

describe("saveFileToDisk", () => {
  it("cria arquivo no diretório do usuário", async () => {
    const userId = "user-abc";
    const buffer = Buffer.from("fake video content");

    const { filePath, storedFilename } = await saveFileToDisk(userId, "test.mp4", "video/mp4", buffer);

    expect(fs.existsSync(filePath)).toBe(true);
    expect(storedFilename).toMatch(/\.mp4$/);
    expect(filePath).toContain(userId);
  });

  it("cria diretório do usuário se não existir", async () => {
    const userId = "new-user-xyz";
    const userDir = path.join(tempDir, userId);
    expect(fs.existsSync(userDir)).toBe(false);

    const buffer = Buffer.from("data");
    await saveFileToDisk(userId, "v.mp4", "video/mp4", buffer);

    expect(fs.existsSync(userDir)).toBe(true);
  });
});

describe("deleteFileFromDisk", () => {
  it("remove arquivo existente", () => {
    const filePath = path.join(tempDir, "toDelete.mp4");
    fs.writeFileSync(filePath, "content");
    expect(fs.existsSync(filePath)).toBe(true);

    deleteFileFromDisk(filePath);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it("não lança exceção para arquivo inexistente", () => {
    const filePath = path.join(tempDir, "ghost.mp4");
    expect(() => deleteFileFromDisk(filePath)).not.toThrow();
  });
});

describe("incrementQuota", () => {
  it("chama $executeRaw com userId e bytes", async () => {
    mockDb.$executeRaw.mockResolvedValue(1);
    await incrementQuota("user-1", BigInt(1024));
    expect(mockDb.$executeRaw).toHaveBeenCalledOnce();
  });
});

describe("decrementQuota", () => {
  it("chama $executeRaw com userId e bytes", async () => {
    mockDb.$executeRaw.mockResolvedValue(1);
    await decrementQuota("user-1", BigInt(1024));
    expect(mockDb.$executeRaw).toHaveBeenCalledOnce();
  });
});
