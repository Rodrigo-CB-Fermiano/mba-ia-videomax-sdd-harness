import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProgressBar } from "../ProgressBar";

describe("ProgressBar", () => {
  const defaultProps = {
    filename: "aula.mp4",
    percentage: 50,
    speedBps: 2_097_152, // 2 MB/s
    etaSeconds: 30,
    onCancel: vi.fn(),
  };

  it("exibe o nome do arquivo", () => {
    render(<ProgressBar {...defaultProps} />);
    expect(screen.getByText("aula.mp4")).toBeTruthy();
  });

  it("exibe o percentual arredondado", () => {
    render(<ProgressBar {...defaultProps} percentage={47.8} />);
    expect(screen.getByText("48%")).toBeTruthy();
  });

  it("exibe velocidade em MB/s quando >= 1 MB/s", () => {
    render(<ProgressBar {...defaultProps} speedBps={2_097_152} />);
    expect(screen.getByText(/MB\/s/)).toBeTruthy();
  });

  it("exibe velocidade em KB/s quando < 1 MB/s", () => {
    render(<ProgressBar {...defaultProps} speedBps={512_000} />);
    expect(screen.getByText(/KB\/s/)).toBeTruthy();
  });

  it("exibe tempo estimado em segundos", () => {
    render(<ProgressBar {...defaultProps} etaSeconds={45} />);
    expect(screen.getByText(/segundos restantes/)).toBeTruthy();
  });

  it("exibe tempo estimado em minutos e segundos quando >= 60s", () => {
    render(<ProgressBar {...defaultProps} etaSeconds={90} />);
    expect(screen.getByText(/1m/)).toBeTruthy();
  });

  it("exibe 'Calculando...' quando etaSeconds é 0", () => {
    render(<ProgressBar {...defaultProps} etaSeconds={0} />);
    expect(screen.getByText("Calculando...")).toBeTruthy();
  });

  it("chama onCancel ao clicar no botão Cancelar", () => {
    const onCancel = vi.fn();
    render(<ProgressBar {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByText("Cancelar"));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
