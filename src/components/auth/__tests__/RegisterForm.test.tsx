import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegisterForm } from "../RegisterForm";

vi.mock("@/server/auth/actions", () => ({
  register: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

const { register } = await import("@/server/auth/actions");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RegisterForm", () => {
  it("renderiza campos de nome, email e senha", () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /criar conta/i })).toBeInTheDocument();
  });

  it("exibe erro quando senha não tem ao menos 1 número", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/nome/i), "Test User");
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/senha/i), "onlyletters");
    await user.click(screen.getByRole("button", { name: /criar conta/i }));

    await waitFor(() => {
      expect(screen.getByText(/ao menos 1 número/i)).toBeInTheDocument();
    });
  });

  it("exibe erro quando email já está em uso", async () => {
    (register as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: "EMAIL_TAKEN",
    });

    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/nome/i), "Test User");
    await user.type(screen.getByLabelText(/email/i), "existing@example.com");
    await user.type(screen.getByLabelText(/senha/i), "Password1");
    await user.click(screen.getByRole("button", { name: /criar conta/i }));

    await waitFor(() => {
      expect(screen.getByText(/email já está cadastrado/i)).toBeInTheDocument();
    });
  });
});
