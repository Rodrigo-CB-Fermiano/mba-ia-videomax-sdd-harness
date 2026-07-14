import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUserFindUnique = vi.fn();
const mockUserCreate = vi.fn();
const mockUserUpdate = vi.fn();
const mockVerificationTokenFindUnique = vi.fn();
const mockVerificationTokenDelete = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: mockUserFindUnique,
      create: mockUserCreate,
      update: mockUserUpdate,
    },
    verificationToken: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      findUnique: mockVerificationTokenFindUnique,
      delete: mockVerificationTokenDelete,
    },
    loginAttempt: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed-password"),
    compare: vi.fn().mockResolvedValue(false),
  },
}));

vi.mock("@/lib/auth", () => ({
  signIn: vi.fn(),
}));

vi.mock("next-auth", () => ({
  AuthError: class AuthError extends Error {
    type = "AuthError";
  },
}));

const mockCheckLockout = vi.fn().mockResolvedValue({ locked: false });
const mockRecordFailedAttempt = vi.fn();
const mockClearAttempts = vi.fn();
const mockGenerateResetToken = vi.fn().mockResolvedValue("test-token");
const mockValidateResetToken = vi.fn();
const mockConsumeResetToken = vi.fn();
const mockSendResetEmail = vi.fn();

vi.mock("@/server/auth/services", () => ({
  checkLockout: mockCheckLockout,
  recordFailedAttempt: mockRecordFailedAttempt,
  clearAttempts: mockClearAttempts,
  generateResetToken: mockGenerateResetToken,
  validateResetToken: mockValidateResetToken,
  consumeResetToken: mockConsumeResetToken,
  sendResetEmail: mockSendResetEmail,
}));

// Import after mocks are set up
const { register, resetPassword, setNewPassword } = await import("../actions");

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckLockout.mockResolvedValue({ locked: false });
  mockGenerateResetToken.mockResolvedValue("test-token");
  mockSendResetEmail.mockResolvedValue(undefined);
  mockConsumeResetToken.mockResolvedValue(undefined);
  mockClearAttempts.mockResolvedValue(undefined);
  mockRecordFailedAttempt.mockResolvedValue(undefined);
});

describe("register", () => {
  it("cria usuário com senha hasheada quando dados são válidos", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    mockUserCreate.mockResolvedValue({ id: "1", email: "new@example.com" });

    const formData = new FormData();
    formData.set("name", "Test User");
    formData.set("email", "new@example.com");
    formData.set("password", "Password1");

    const result = await register(formData);

    expect(result).toEqual({ success: true });
    expect(mockUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "new@example.com",
          name: "Test User",
          password: "hashed-password",
        }),
      })
    );
  });

  it("retorna EMAIL_TAKEN quando email já existe", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "1", email: "existing@example.com" });

    const formData = new FormData();
    formData.set("name", "Test User");
    formData.set("email", "existing@example.com");
    formData.set("password", "Password1");

    const result = await register(formData);

    expect(result).toEqual({ error: "EMAIL_TAKEN" });
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it("retorna VALIDATION quando senha fraca", async () => {
    const formData = new FormData();
    formData.set("name", "Test User");
    formData.set("email", "new@example.com");
    formData.set("password", "weakpass");

    const result = await register(formData);

    expect(result?.error).toBe("VALIDATION");
  });
});

describe("resetPassword", () => {
  it("envia email quando usuário existe", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "1", email: "user@example.com" });

    const formData = new FormData();
    formData.set("email", "user@example.com");

    const result = await resetPassword(formData);

    expect(result).toEqual({ success: true });
    expect(mockSendResetEmail).toHaveBeenCalledWith("user@example.com", "test-token");
  });

  it("retorna success mesmo quando email não existe (não revela existência)", async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("email", "nonexistent@example.com");

    const result = await resetPassword(formData);

    expect(result).toEqual({ success: true });
    expect(mockSendResetEmail).not.toHaveBeenCalled();
  });
});

describe("setNewPassword", () => {
  it("atualiza senha quando token é válido", async () => {
    mockValidateResetToken.mockResolvedValue({
      valid: true,
      email: "user@example.com",
    });
    mockUserFindUnique.mockResolvedValue({ id: "1", email: "user@example.com" });
    mockUserUpdate.mockResolvedValue({});

    const formData = new FormData();
    formData.set("token", "valid-token");
    formData.set("password", "NewPassword1");

    const result = await setNewPassword(formData);

    expect(result).toEqual({ success: true });
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { password: "hashed-password" },
      })
    );
    expect(mockConsumeResetToken).toHaveBeenCalledWith("valid-token");
  });

  it("retorna TOKEN_INVALID quando token é inválido", async () => {
    mockValidateResetToken.mockResolvedValue({ valid: false });

    const formData = new FormData();
    formData.set("token", "invalid-token");
    formData.set("password", "NewPassword1");

    const result = await setNewPassword(formData);

    expect(result).toEqual({ error: "TOKEN_INVALID" });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("retorna TOKEN_INVALID quando token está expirado", async () => {
    mockValidateResetToken.mockResolvedValue({ valid: false });

    const formData = new FormData();
    formData.set("token", "expired-token");
    formData.set("password", "NewPassword1");

    const result = await setNewPassword(formData);

    expect(result).toEqual({ error: "TOKEN_INVALID" });
  });
});
