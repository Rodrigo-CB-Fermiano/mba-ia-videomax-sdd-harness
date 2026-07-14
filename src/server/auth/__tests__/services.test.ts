import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkLockout, recordFailedAttempt, clearAttempts } from "../services";

vi.mock("@/lib/db", () => ({
  db: {
    loginAttempt: {
      count: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    verificationToken: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

const { db } = await import("@/lib/db");
const mockDb = db as unknown as {
  loginAttempt: {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkLockout", () => {
  it("retorna locked: false quando tentativas < 5", async () => {
    mockDb.loginAttempt.count.mockResolvedValue(4);
    const result = await checkLockout("user@example.com");
    expect(result).toEqual({ locked: false });
  });

  it("retorna locked: true quando tentativas >= 5", async () => {
    mockDb.loginAttempt.count.mockResolvedValue(5);
    const result = await checkLockout("user@example.com");
    expect(result).toEqual({ locked: true });
  });

  it("retorna locked: true quando tentativas > 5", async () => {
    mockDb.loginAttempt.count.mockResolvedValue(8);
    const result = await checkLockout("user@example.com");
    expect(result).toEqual({ locked: true });
  });

  it("consulta tentativas dentro da janela de 15 minutos", async () => {
    mockDb.loginAttempt.count.mockResolvedValue(0);
    const before = Date.now();
    await checkLockout("user@example.com");
    const after = Date.now();

    const callArgs = mockDb.loginAttempt.count.mock.calls[0][0];
    const windowStart: Date = callArgs.where.attemptedAt.gte;

    expect(windowStart.getTime()).toBeGreaterThanOrEqual(before - 15 * 60 * 1000);
    expect(windowStart.getTime()).toBeLessThanOrEqual(after - 15 * 60 * 1000 + 100);
  });
});

describe("recordFailedAttempt", () => {
  it("cria registro no banco com email", async () => {
    mockDb.loginAttempt.create.mockResolvedValue({});
    await recordFailedAttempt("user@example.com");
    expect(mockDb.loginAttempt.create).toHaveBeenCalledWith({
      data: { email: "user@example.com", userId: undefined },
    });
  });

  it("cria registro com userId quando fornecido", async () => {
    mockDb.loginAttempt.create.mockResolvedValue({});
    await recordFailedAttempt("user@example.com", "user-123");
    expect(mockDb.loginAttempt.create).toHaveBeenCalledWith({
      data: { email: "user@example.com", userId: "user-123" },
    });
  });
});

describe("clearAttempts", () => {
  it("remove todas as tentativas do email", async () => {
    mockDb.loginAttempt.deleteMany.mockResolvedValue({ count: 3 });
    await clearAttempts("user@example.com");
    expect(mockDb.loginAttempt.deleteMany).toHaveBeenCalledWith({
      where: { email: "user@example.com" },
    });
  });
});
