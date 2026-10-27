// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import InvoiceCalculator from "./InvoiceCalculator";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function enter(label: RegExp, value: string): void {
  fireEvent.input(screen.getByLabelText(label), { target: { value } });
}

function fillInvoiceForm(receipt = false): void {
  enter(/Nomor dokumen/, "INV-TEST-001");
  fireEvent.input(screen.getByLabelText(/Tanggal dokumen/), {
    target: { value: "2026-10-27" },
  });
  enter(receipt ? /Nama penerima pembayaran/ : /Nama penjual/, "Toko Contoh");
  enter(receipt ? /Diterima dari/ : /Ditagihkan kepada/, "Pelanggan Contoh");
  enter(/Nama barang atau jasa/, "Kertas");
  enter(/Kuantitas/, "1,5");
  enter(/Satuan/, "rim");
  enter(/Harga satuan/, "10.000");
}

describe("Phase 1.11 invoice and receipt interface", () => {
  it("calculates locally and reconciles item, subtotal, discount, and total", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<InvoiceCalculator />);
    fillInvoiceForm();
    enter(/Diskon nominal/, "2.000");
    fireEvent.click(screen.getByRole("button", { name: "Buat invoice" }));

    expect(screen.getByRole("heading", { name: "INVOICE" })).toBeTruthy();
    expect(screen.getByText("Pelanggan Contoh")).toBeTruthy();
    expect(screen.getAllByText("Rp 15.000").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Rp 13.000")).toBeTruthy();
    expect(screen.getByText(/Pajak, PPN, pemotongan, dan bea meterai tidak dihitung/)).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shows explicit errors for missing identity/date and an invalid quantity", () => {
    render(<InvoiceCalculator />);
    fireEvent.click(screen.getByRole("button", { name: "Buat invoice" }));
    expect(screen.getByRole("alert").textContent).toMatch(/Nomor dokumen wajib/i);

    enter(/Nomor dokumen/, "INV-1");
    fireEvent.click(screen.getByRole("button", { name: "Buat invoice" }));
    expect(screen.getByRole("alert").textContent).toMatch(/Tanggal dokumen wajib/i);

    fireEvent.input(screen.getByLabelText(/Tanggal dokumen/), {
      target: { value: "2026-10-27" },
    });
    enter(/Nama penjual/, "Penjual");
    enter(/Ditagihkan kepada/, "Pembeli");
    fireEvent.input(screen.getByLabelText(/Jatuh tempo/), {
      target: { value: "2026-10-26" },
    });
    enter(/Nama barang atau jasa/, "Jasa");
    enter(/Harga satuan/, "10000");
    fireEvent.click(screen.getByRole("button", { name: "Buat invoice" }));
    expect(screen.getByRole("alert").textContent).toMatch(/Tanggal jatuh tempo/i);

    fireEvent.input(screen.getByLabelText(/Jatuh tempo/), {
      target: { value: "" },
    });
    enter(/Nama barang atau jasa/, "Jasa");
    enter(/Kuantitas/, "1.5");
    fireEvent.click(screen.getByRole("button", { name: "Buat invoice" }));
    expect(screen.getByRole("alert").textContent).toMatch(/maksimal tiga desimal/i);
  });

  it("produces a visibly distinct receipt and clears a stale result after edits", () => {
    render(<InvoiceCalculator />);
    fireEvent.click(screen.getByRole("radio", { name: /Kwitansi/ }));
    fillInvoiceForm(true);
    fireEvent.click(screen.getByRole("button", { name: "Buat kwitansi" }));

    expect(screen.getByRole("heading", { name: "KWITANSI" })).toBeTruthy();
    expect(screen.getByText(/Telah diterima pembayaran dari/)).toBeTruthy();
    enter(/Nama barang atau jasa/, "Perubahan");
    expect(screen.queryByRole("heading", { name: "KWITANSI" })).toBeNull();
  });

  it("rejects a discount greater than subtotal and does not emit tax values", () => {
    render(<InvoiceCalculator />);
    fillInvoiceForm();
    enter(/Diskon nominal/, "20.000");
    fireEvent.click(screen.getByRole("button", { name: "Buat invoice" }));
    expect(screen.getByRole("alert").textContent).toMatch(/Diskon tidak boleh melebihi subtotal/i);
    expect(screen.queryByRole("heading", { name: "INVOICE" })).toBeNull();
  });

  it("invokes browser print only after the calculated document is visible", () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    render(<InvoiceCalculator />);
    fillInvoiceForm();
    fireEvent.click(screen.getByRole("button", { name: "Buat invoice" }));
    fireEvent.click(screen.getByRole("button", { name: "Cetak / simpan PDF" }));

    expect(screen.getByRole("heading", { name: "INVOICE" })).toBeTruthy();
    expect(printSpy).toHaveBeenCalledTimes(1);
  });
});
