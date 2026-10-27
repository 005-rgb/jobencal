// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import HppCalculator from "./HppCalculator";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function enter(label: string | RegExp, value: string): void {
  fireEvent.input(screen.getByLabelText(label, { exact: false }), {
    target: { value },
  });
}

describe("HPP calculator interface", () => {
  it("calculates batch and unit HPP with material waste locally", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<HppCalculator />);

    enter("Hasil produksi", "100");
    enter("Biaya bahan sebelum susut", "1.000.000");
    enter("Susut bahan", "10");
    enter("Tenaga kerja langsung", "500.000");
    fireEvent.click(screen.getByLabelText(/Saya sudah memasukkan semua biaya/i));
    fireEvent.click(screen.getByRole("button", { name: "Hitung HPP" }));

    expect(screen.getByRole("heading", { name: "HPP produksi Anda" })).toBeTruthy();
    expect(screen.getAllByText("Rp 1.611.111").length).toBeGreaterThan(1);
    expect(screen.getAllByText("Rp 16.111").length).toBeGreaterThan(1);
    expect(screen.getByText(/Penyesuaian susut 10%/i)).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shows the selected allocation method and keeps unconfirmed costs provisional", () => {
    render(<HppCalculator />);
    enter("Hasil produksi", "10");
    enter("Biaya bahan sebelum susut", "100.000");
    fireEvent.click(screen.getByRole("button", { name: /Tambah overhead atau penyusutan/i }));
    enter("Nama biaya", "Listrik");
    enter("Total biaya dalam pool", "100.000");
    enter("Nama penggerak alokasi", "jam mesin");
    enter("Pemakaian penggerak batch", "5");
    enter("Total penggerak untuk semua produksi", "10");
    fireEvent.click(screen.getByRole("button", { name: "Hitung HPP" }));

    expect(screen.getByText(/Hasil sementara karena kelengkapan biaya belum dikonfirmasi/i)).toBeTruthy();
    expect(screen.getByText("Alokasi jam mesin: 5 ÷ 10")).toBeTruthy();
    expect(screen.getByText(/konfirmasi semua biaya/i)).toBeTruthy();
  });

  it("does not calculate zero production units", () => {
    render(<HppCalculator />);
    enter("Hasil produksi", "0");
    enter("Biaya bahan sebelum susut", "10.000");
    fireEvent.click(screen.getByRole("button", { name: "Hitung HPP" }));
    expect(screen.getByRole("alert").textContent).toMatch(/lebih besar dari nol/i);
    expect(screen.queryByRole("heading", { name: "HPP produksi Anda" })).toBeNull();
  });
});
