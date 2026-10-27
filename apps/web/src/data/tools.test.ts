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
});
