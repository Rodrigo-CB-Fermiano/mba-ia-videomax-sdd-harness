import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

const { auth } = await import("@/lib/auth");
const { db } = await import("@/lib/db");

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockDb = db as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
};

import { getQuota } from "../actions";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getQuota", () => {
  it("retorna usedBytes e maxBytes para usuário autenticado", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDb.user.findUnique.mockResolvedValue({
      storageUsedBytes: BigInt(524_288_000),
    });

    const result = await getQuota();
    expect(result.usedBytes).toBe(524_288_000);
    expect(result.maxBytes).toBe(1_073_741_824);
  });

  it("lança erro quando não há sessão", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(getQuota()).rejects.toThrow("UNAUTHORIZED");
  });

  it("lança erro quando usuário não encontrado no banco", async () => {
    mockAuth.mockResolvedValue({ user: { id: "ghost-user" } });
    mockDb.user.findUnique.mockResolvedValue(null);
    await expect(getQuota()).rejects.toThrow("UNAUTHORIZED");
  });
});
