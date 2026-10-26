// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import CoreSystemPlayground from "./CoreSystemPlayground";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("core system playground", () => {
  it("calculates locally and shows the result and rounding method", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<CoreSystemPlayground />);

    fireEvent.click(screen.getByRole("button", { name: /hitung hasil/i }));

    expect(screen.getAllByText("Rp 37.500").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/setengah menjauhi nol/i).length).toBeGreaterThan(
      0,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shows an actionable error for malformed money instead of a fake result", () => {
    render(<CoreSystemPlayground />);
    fireEvent.input(screen.getByLabelText(/nominal dasar/i), {
      target: { value: "1,50" },
    });
    fireEvent.click(screen.getByRole("button", { name: /hitung hasil/i }));

    expect(screen.getByRole("alert").textContent).toContain(
      "Masukkan angka Rupiah utuh",
    );
    expect(screen.queryByText("Rp 37.500")).toBeNull();
  });
});
