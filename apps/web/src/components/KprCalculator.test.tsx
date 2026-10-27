// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import KprCalculator from "./KprCalculator";

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  if (originalScrollIntoView) {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: originalScrollIntoView,
    });
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function enter(label: string, value: string): void {
  fireEvent.input(screen.getByLabelText(new RegExp(label, "i")), {
    target: { value },
  });
}

describe("KPR calculator interface", () => {
  it("calculates and renders a model-specific schedule locally", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<KprCalculator />);

    enter("Pokok pinjaman", "1.200.000");
    enter("Tenor", "4");
    enter("Suku bunga awal", "12");
    fireEvent.change(screen.getByLabelText("Model amortisasi"), {
      target: { value: "flat" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Hitung simulasi KPR" }));

    expect(screen.getByRole("heading", { name: "Rincian angsuran" })).toBeTruthy();
    expect(screen.getByText("Rp 48.000")).toBeTruthy();
    expect(screen.getAllByText("Rp 312.000").length).toBeGreaterThan(1);
    expect(screen.getAllByRole("row")).toHaveLength(5);
    expect(screen.getByText(/bunga dihitung dari pokok awal setiap bulan/i)).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("connects floating rates, extra principal, costs, and quote notes to the report", () => {
    render(<KprCalculator />);
    enter("Pokok pinjaman", "1.000.000");
    enter("Tenor", "5");
    enter("Suku bunga awal", "12");

    fireEvent.click(
      screen.getByLabelText(/Simulasikan bunga tetap lalu mengambang/i),
    );
    enter("Periode bunga tetap", "2");
    enter("Suku bunga setelah periode tetap", "24");
    enter("Bulan pembayaran tambahan", "2");
    enter("Nominal pokok tambahan", "250.000");
    enter("Provisi", "10.000");
    enter("Administrasi", "5.000");
    enter("Asuransi", "2.000");
    enter("Pajak & notaris", "3.000");
    fireEvent.click(screen.getByText(/Catat referensi kutipan bank/i));
    enter("Nama bank / produk", "Produk Contoh");
    fireEvent.input(screen.getByLabelText(/Tanggal kutipan/i), {
      target: { value: "2026-10-01" },
    });
    fireEvent.input(screen.getByLabelText(/Berlaku sampai/i), {
      target: { value: "2026-12-31" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Hitung simulasi KPR" }));

    expect(screen.getAllByText("Rp 250.000")).toHaveLength(2);
    expect(screen.getByText("Rp 20.000")).toBeTruthy();
    expect(screen.getByText(/Produk Contoh/)).toBeTruthy();
    expect(screen.getByText(/suku bunga mengambang/i)).toBeTruthy();
    expect(screen.getAllByRole("row")).toHaveLength(6);
  });

  it("shows an input error instead of stale results when the term exceeds the limit", () => {
    render(<KprCalculator />);
    enter("Pokok pinjaman", "1.000.000");
    enter("Tenor", "361");
    enter("Suku bunga awal", "12");
    fireEvent.click(screen.getByRole("button", { name: "Hitung simulasi KPR" }));

    expect(screen.getByRole("alert").textContent).toContain(
      "antara 1 dan 360 bulan",
    );
    expect(screen.queryByRole("heading", { name: "Rincian angsuran" })).toBeNull();
  });
});
