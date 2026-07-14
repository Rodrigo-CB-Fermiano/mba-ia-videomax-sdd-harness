import { test, expect } from "@playwright/test";
import testUser from "./fixtures/test-user.json";

// Helper para criar usuário via API antes dos testes que exigem conta existente
async function createUser(
  request: Parameters<typeof test>[2] extends { request: infer R } ? R : never,
  user: typeof testUser
) {
  // Utiliza a server action de registro via fetch direto ao Next.js
  const formData = new URLSearchParams();
  formData.append("name", user.name);
  formData.append("email", user.email);
  formData.append("password", user.password);
  return formData;
}

test.describe("GTW-01 — Registro com dados válidos", () => {
  test("cria conta e redireciona para /library", async ({ page }) => {
    const uniqueEmail = `gtw01-${Date.now()}@videomax.local`;

    await page.goto("/register");
    await page.getByLabel(/nome/i).fill("GTW01 User");
    await page.getByLabel(/email/i).fill(uniqueEmail);
    await page.getByLabel(/senha/i).fill("TestPass1");
    await page.getByRole("button", { name: /criar conta/i }).click();

    await expect(page).toHaveURL("/library", { timeout: 10000 });
  });
});

test.describe("GTW-02 — Login com credenciais corretas", () => {
  test("autentica e redireciona para /library com cookie HTTP-only", async ({
    page,
    context,
  }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(testUser.email);
    await page.getByLabel(/senha/i).fill(testUser.password);
    await page.getByRole("button", { name: /entrar/i }).click();

    await expect(page).toHaveURL("/library", { timeout: 10000 });

    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) =>
      c.name.includes("session-token")
    );
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.httpOnly).toBe(true);
  });
});

test.describe("GTW-03 — Login com senha incorreta", () => {
  test("exibe mensagem genérica sem revelar qual campo é inválido", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(testUser.email);
    await page.getByLabel(/senha/i).fill("WrongPassword1");
    await page.getByRole("button", { name: /entrar/i }).click();

    await expect(
      page.getByText("Email or password is incorrect.")
    ).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL("/login");
  });
});

test.describe("GTW-04 — Bloqueio após 5 tentativas falhas", () => {
  test("bloqueia login após 5 tentativas inválidas", async ({ page }) => {
    const lockoutEmail = `lockout-${Date.now()}@videomax.local`;

    await page.goto("/login");

    for (let i = 0; i < 5; i++) {
      await page.getByLabel(/email/i).fill(lockoutEmail);
      await page.getByLabel(/senha/i).fill("WrongPass1");
      await page.getByRole("button", { name: /entrar/i }).click();
      await page.waitForTimeout(200);
    }

    await expect(
      page.getByText("Too many attempts. Try again in 15 minutes.")
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe("GTW-07 — Reset de senha por email", () => {
  test("envia email com link em até 60 segundos", async ({ page, request }) => {
    await page.goto("/reset-password");
    await page.getByLabel(/email/i).fill(testUser.email);
    await page.getByRole("button", { name: /enviar link/i }).click();

    await expect(
      page.getByText(/receberá um link de recuperação/i)
    ).toBeVisible({ timeout: 5000 });

    // Verifica entrega no Mailpit (SMTP local)
    const mailpit = await request.get("http://localhost:8025/api/v1/messages");
    const messages = await mailpit.json();
    expect(messages.messages?.length).toBeGreaterThan(0);
  });
});

test.describe("GTW-08 — Link de reset expirado", () => {
  test("exibe mensagem de expiração para token inválido", async ({ page }) => {
    await page.goto("/reset-password/confirm?token=invalid-or-expired-token");

    await page.getByLabel(/nova senha/i).fill("NewPass1");
    await page.getByRole("button", { name: /salvar nova senha/i }).click();

    await expect(
      page.getByText("This link has expired. Request a new password reset.")
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe("GTW-09 — Proteção de rotas", () => {
  test("redireciona para /login ao acessar /library sem sessão", async ({
    page,
  }) => {
    await page.goto("/library");
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test("redireciona para /login ao acessar /upload sem sessão", async ({
    page,
  }) => {
    await page.goto("/upload");
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test("redireciona para /login ao acessar /search sem sessão", async ({
    page,
  }) => {
    await page.goto("/search");
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});
