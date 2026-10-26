import { describe, expect, it } from "vitest";
import { canShowAdGate, getAllowedModuleDestination } from "./ad-gate.js";

describe("ad gate eligibility", () => {
  it.each([
    [false, true, true, false],
    [true, false, true, false],
    [true, true, false, false],
    [true, true, true, true],
  ])(
    "requires server activation, user consent, and a configured provider",
    (enabled, consent, provider, expected) => {
      expect(canShowAdGate(enabled, consent, provider)).toBe(expected);
    },
  );
});

describe("module ad-gate destinations", () => {
  it("allows only known module routes", () => {
    expect(getAllowedModuleDestination("/modul/gaji-bersih")).toBe(
      "/modul/gaji-bersih",
    );
    expect(getAllowedModuleDestination("/modul/not-a-module")).toBeNull();
  });

  it("rejects external URLs, query strings, and unrelated routes", () => {
    expect(getAllowedModuleDestination("https://example.com")).toBeNull();
    expect(getAllowedModuleDestination("//example.com/modul/gaji-bersih")).toBeNull();
    expect(getAllowedModuleDestination("/modul/gaji-bersih?next=/")).toBeNull();
    expect(getAllowedModuleDestination("/")).toBeNull();
  });
});
