// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import PriceMarginCalculator from "./PriceMarginCalculator";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function enter(label: string | RegExp, value: string): void {
  const matcher = typeof label === "string" ? new RegExp(label) : label;
  fireEvent.input(screen.getByRole("textbox", { name: matcher }), {
    target: { value },
  });
}

describe("price and margin calculator interface", () => {
  it("calculates a target margin locally and shows its basis", () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ adsEnabled: false }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    render(<PriceMarginCalculator />);

    enter("Biaya dasar / HPP per produk", "100.000");
    enter("Target margin", "25");
    fireEvent.click(screen.getByRole("button", { name: "Hitung harga jual" }));

    expect(screen.getByRole("heading", { name: "Hasil siap dihitung" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Harga jual rekomendasi" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Lihat hasil" }));

    expect(screen.getByRole("heading", { name: "Harga jual rekomendasi" })).toBeTruthy();
    expect(screen.getAllByText("Rp 133.334")).toHaveLength(2);
    expect(screen.getAllByText("Rp 33.334")).toHaveLength(2);
    expect(screen.getByText("Margin aktual")).toBeTruthy();
    expect(screen.getByText("Laba bersih ÷ omzet setelah diskon")).toBeTruthy();
    expect(JSON.stringify(fetchSpy.mock.calls)).not.toContain("100.000");
  });

  it("keeps markup as a separate mode from margin", () => {
    render(<PriceMarginCalculator />);
    fireEvent.click(screen.getByRole("radio", { name: /Target markup/ }));
    enter("Biaya dasar / HPP per produk", "100.000");
    enter("Target markup", "25");
    fireEvent.click(screen.getByRole("button", { name: "Hitung harga jual" }));
    fireEvent.click(screen.getByRole("button", { name: "Lihat hasil" }));

    expect(screen.getAllByText("Rp 125.000")).toHaveLength(2);
    expect(screen.getAllByText("Rp 25.000")).toHaveLength(2);
    expect(screen.getByText("20%")).toBeTruthy();
    expect(screen.getByText("25%")).toBeTruthy();
  });

  it("reports a loss when checking an existing selling price", () => {
    render(<PriceMarginCalculator />);
    fireEvent.click(screen.getByRole("radio", { name: /Cek harga jual/ }));
    enter("Biaya dasar / HPP per produk", "60.000");
    enter("Harga jual tertera", "50.000");
    fireEvent.click(screen.getByRole("button", { name: "Cek harga jual" }));
    fireEvent.click(screen.getByRole("button", { name: "Lihat hasil" }));

    expect(screen.getAllByText("−Rp 10.000")).toHaveLength(2);
    expect(screen.getByRole("status").textContent).toMatch(/belum menutup biaya/i);
  });

  it("explains why a 100% margin target cannot be calculated", () => {
    render(<PriceMarginCalculator />);
    enter("Biaya dasar / HPP per produk", "100.000");
    enter("Target margin", "100");
    fireEvent.click(screen.getByRole("button", { name: "Hitung harga jual" }));
    fireEvent.click(screen.getByRole("button", { name: "Lihat hasil" }));

    expect(screen.getByRole("alert").textContent).toMatch(/tidak mungkin/i);
    expect(screen.queryByRole("heading", { name: "Harga jual rekomendasi" })).toBeNull();
  });
});
