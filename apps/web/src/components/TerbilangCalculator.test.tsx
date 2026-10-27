// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import TerbilangCalculator from "./TerbilangCalculator";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function enter(value: string): void {
  fireEvent.input(screen.getByLabelText(/Angka yang akan diubah/), {
    target: { value },
  });
}

describe("terbilang calculator interface", () => {
  it("keeps exact results behind the results gate and calculates locally", () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ adsEnabled: false }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    render(<TerbilangCalculator />);

    enter("1.234,50");
    fireEvent.click(
      screen.getByRole("button", { name: "Ubah menjadi terbilang" }),
    );

    expect(
      screen.getByRole("heading", { name: "Hasil siap dihitung" }),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Hasil terbilang" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Lihat hasil" }));
    expect(screen.getByRole("heading", { name: "Hasil terbilang" })).toBeTruthy();
    expect(
      screen.getByText("seribu dua ratus tiga puluh empat koma lima nol"),
    ).toBeTruthy();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/v1/public/monetization");
    expect(JSON.stringify(fetchSpy.mock.calls)).not.toContain("1.234,50");
  });

  it("adds Rupiah after the integer part and preserves decimal zeroes", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ adsEnabled: false }),
      }),
    );
    render(<TerbilangCalculator />);
    enter("-1.500,00");
    fireEvent.click(
      screen.getByRole("radio", { name: /Nominal Rupiah/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Ubah menjadi terbilang" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Lihat hasil" }));

    expect(
      screen.getByText(
        "minus seribu lima ratus rupiah koma nol nol",
      ),
    ).toBeTruthy();
  });

  it("explains invalid syntax and out-of-range values before showing a result gate", () => {
    render(<TerbilangCalculator />);
    enter("1.23");
    fireEvent.click(
      screen.getByRole("button", { name: "Ubah menjadi terbilang" }),
    );
    expect(screen.getByRole("alert").textContent).toMatch(/format tidak dikenali/i);
    expect(screen.queryByRole("heading", { name: "Hasil siap dihitung" })).toBeNull();

    enter("1.000.000.000.000.000.000");
    fireEvent.click(
      screen.getByRole("button", { name: "Ubah menjadi terbilang" }),
    );
    expect(screen.getByRole("alert").textContent).toMatch(/melampaui batas/i);
  });

  it("uses a separate download gate and clears stale results when input changes", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ adsEnabled: false }),
      }),
    );
    render(<TerbilangCalculator />);
    enter("21");
    fireEvent.click(
      screen.getByRole("button", { name: "Ubah menjadi terbilang" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Lihat hasil" }));

    fireEvent.click(screen.getByRole("button", { name: "Unduh .txt" }));
    expect(
      screen.getByRole("heading", { name: "Unduhan siap dibuat" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Lanjutkan unduhan" }),
    ).toBeTruthy();

    enter("22");
    expect(screen.queryByRole("heading", { name: "Hasil terbilang" })).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Unduhan siap dibuat" }),
    ).toBeNull();
  });
});
