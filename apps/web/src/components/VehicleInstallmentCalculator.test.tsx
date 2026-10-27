// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import VehicleInstallmentCalculator from "./VehicleInstallmentCalculator";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function enter(label: RegExp | string, value: string): void {
  fireEvent.input(screen.getByLabelText(label), { target: { value } });
}

describe("vehicle installment calculator interface", () => {
  it("calculates a selected model in-browser and renders a reconciled schedule", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<VehicleInstallmentCalculator />);

    enter("Harga kendaraan", "1.200.000");
    enter("Uang muka", "0");
    enter(/Tenor/, "4");
    enter(/Bunga nominal tahunan/, "12");
    fireEvent.change(screen.getByLabelText("Metode angsuran"), {
      target: { value: "flat" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Hitung simulasi" }));

    expect(
      screen.getByRole("heading", { name: "Rincian cicilan kendaraan" }),
    ).toBeTruthy();
    expect(screen.getByText("Rp 48.000")).toBeTruthy();
    expect(screen.getAllByRole("row")).toHaveLength(5);
    expect(screen.getByText(/bukan tarif pasar/)).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("separates upfront and financed fees and captures user quote provenance", () => {
    render(<VehicleInstallmentCalculator />);
    enter("Harga kendaraan", "1.200.000");
    enter("Uang muka", "0");
    enter(/Tenor/, "4");
    enter(/Bunga nominal tahunan/, "0");
    enter("Administrasi", "40.000");
    fireEvent.change(document.getElementById("vehicle-administration-payment")!, {
      target: { value: "financed" },
    });
    fireEvent.click(screen.getByText("Catat referensi kutipan produk (opsional)"));
    enter("Pemberi pembiayaan", "Lembaga Contoh");
    enter("Nama produk", "Paket Kendaraan A");
    enter("URL sumber kutipan", "https://example.com/quote");
    fireEvent.input(screen.getByLabelText("Tanggal kutipan"), {
      target: { value: "2026-10-01" },
    });
    fireEvent.input(screen.getByLabelText("Berlaku sampai"), {
      target: { value: "2026-12-31" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Hitung simulasi" }));

    expect(screen.getAllByText("Rp 1.240.000").length).toBeGreaterThan(1);
    expect(screen.getByText(/Biaya masuk pokok pembiayaan/)).toBeTruthy();
    expect(screen.getByText(/Lembaga Contoh/)).toBeTruthy();
    expect(screen.getByText(/Belum diverifikasi/)).toBeTruthy();
  });

  it("requires complete quote provenance and clears stale results after edits", () => {
    render(<VehicleInstallmentCalculator />);
    enter("Harga kendaraan", "1.200.000");
    enter("Uang muka", "0");
    enter(/Tenor/, "4");
    enter(/Bunga nominal tahunan/, "0");
    fireEvent.click(screen.getByRole("button", { name: "Hitung simulasi" }));
    expect(
      screen.getByRole("heading", { name: "Rincian cicilan kendaraan" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByText("Catat referensi kutipan produk (opsional)"));
    enter("Pemberi pembiayaan", "Lembaga Contoh");
    fireEvent.click(screen.getByRole("button", { name: "Hitung simulasi" }));
    expect(screen.getByRole("alert").textContent).toContain(
      "URL sumber, tanggal kutipan",
    );
    expect(
      screen.queryByRole("heading", { name: "Rincian cicilan kendaraan" }),
    ).toBeNull();
  });
});
