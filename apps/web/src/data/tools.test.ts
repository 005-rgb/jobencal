import { describe, expect, it } from "vitest";
import { getToolBySlug, tools } from "./tools.js";

describe("tool catalogue", () => {
  it("contains all twelve Phase 1 tools with unique stable slugs", () => {
    expect(tools).toHaveLength(12);
    expect(new Set(tools.map((tool) => tool.slug)).size).toBe(tools.length);
    expect(tools.map((tool) => tool.phase)).toEqual([
      "1.1",
      "1.2",
      "1.3",
      "1.4",
      "1.5",
      "1.6",
      "1.7",
      "1.8",
      "1.9",
      "1.10",
      "1.11",
      "1.12",
    ]);
  });

  it("looks up known slugs and returns no fallback for unknown tools", () => {
    expect(getToolBySlug("terbilang")?.name).toBe("Terbilang");
    expect(getToolBySlug("not-a-tool")).toBeUndefined();
  });

  it("describes Phase 1.3 as a user-input mortgage simulation, not a bank tariff", () => {
    const kpr = getToolBySlug("simulasi-kpr");
    expect(kpr?.phase).toBe("1.3");
    expect(kpr?.description).toMatch(/anuitas, flat, dan efektif/i);
    expect(kpr?.description).toMatch(/bunga berjenjang/i);
    expect(kpr?.description).toMatch(/pelunasan tambahan/i);
  });

  it("describes Phase 1.4 as batch and per-unit cost with explicit allocations", () => {
    const hpp = getToolBySlug("kalkulator-hpp");
    expect(hpp?.phase).toBe("1.4");
    expect(hpp?.description).toMatch(/batch dan HPP per unit/i);
    expect(hpp?.description).toMatch(/overhead dan penyusutan/i);
  });

  it("lists the Phase 1.11 invoice and receipt tool", () => {
    const invoice = getToolBySlug("invoice-kwitansi");
    expect(invoice?.phase).toBe("1.11");
    expect(invoice?.name).toBe("Invoice & Kwitansi");
    expect(invoice?.description).toMatch(/invoice atau kwitansi umum/i);
  });
});
