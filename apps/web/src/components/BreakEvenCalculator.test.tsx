// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import BreakEvenCalculator from "./BreakEvenCalculator";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function enter(label: string, value: string): void {
  fireEvent.input(screen.getByLabelText(new RegExp(label)), {
    target: { value },
  });
}

describe("break-even calculator interface", () => {
  it("shows exact fractional BEP, whole-unit threshold, and nearby profit locally", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<BreakEvenCalculator />);

    enter("Biaya tetap untuk periode ini", "100.000");
    enter("Harga jual per unit", "60.000");
    enter("Biaya variabel per unit", "20.000");
    fireEvent.click(
      screen.getByRole("button", { name: "Hitung titik impas" }),
    );

    expect(
      screen.getByRole("heading", { name: "Titik impas usaha Anda" }),
    ).toBeTruthy();
    expect(screen.getByText("5 / 2 unit (≈ 2,5 unit)")).toBeTruthy();
    expect(screen.getByText("3 unit")).toBeTruthy();
    expect(screen.getByText("Rp 150.000")).toBeTruthy();
    expect(screen.getByText("Rp 180.000")).toBeTruthy();
    expect(screen.getByText(/−Rp 20.000/)).toBeTruthy();
    expect(screen.getAllByText("Rp 20.000").length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("explains why a zero or negative contribution has no valid BEP", () => {
    render(<BreakEvenCalculator />);
    enter("Biaya tetap untuk periode ini", "10.000");
    enter("Harga jual per unit", "20.000");
    enter("Biaya variabel per unit", "20.000");
    fireEvent.click(
      screen.getByRole("button", { name: "Hitung titik impas" }),
    );

    expect(screen.getByRole("alert").textContent).toMatch(/kontribusi per unit nol/i);
    expect(
      screen.queryByRole("heading", { name: "Titik impas usaha Anda" }),
    ).toBeNull();
  });

  it("requires all three money inputs", () => {
    render(<BreakEvenCalculator />);
    enter("Biaya tetap untuk periode ini", "10.000");
    fireEvent.click(
      screen.getByRole("button", { name: "Hitung titik impas" }),
    );

    expect(screen.getByRole("alert").textContent).toMatch(
      /harga jual per unit wajib diisi/i,
    );
  });
});
