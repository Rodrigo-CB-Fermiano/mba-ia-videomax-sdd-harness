import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "../LoginForm";

vi.mock("@/server/auth/actions", () => ({
  loginAction: vi.fn(),
}));

const { loginAction } = await import("@/server/auth/actions");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LoginForm", () => {
  it("renderiza campos de email e senha", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /entrar/i })).toBeInTheDocument();
  });

  it("exibe erro de validação para email inválido", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), "invalid");
    await user.click(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() => {
      expect(screen.getByText(/email inválido/i)).toBeInTheDocument();
    });
  });

  it("exibe mensagem genérica para credenciais incorretas", async () => {
    (loginAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: "CREDENTIALS",
    });

    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.type(screen.getByLabelText(/senha/i), "wrongpass");
    await user.click(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Email or password is incorrect.")
      ).toBeInTheDocument();
    });
  });

  it("exibe mensagem de bloqueio após muitas tentativas", async () => {
    (loginAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: "LOCKED",
    });

    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.type(screen.getByLabelText(/senha/i), "anypassword");
    await user.click(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Too many attempts. Try again in 15 minutes.")
      ).toBeInTheDocument();
    });
  });
});
