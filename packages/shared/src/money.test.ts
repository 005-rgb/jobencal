import { describe, expect, it } from "vitest";
import {
  formatPercentage,
  formatRupiah,
  MAX_RUPIAH,
  parsePercentageInput,
  parseRupiahInput,
  SharedDomainError,
} from "./money.js";

describe("Rupiah integer parsing", () => {
  it.each([
    ["1500000", 1_500_000n],
    ["1.500.000", 1_500_000n],
    ["0", 0n],
    ["9007199254740993", 9_007_199_254_740_993n],
  ])("parses %s without floating-point loss", (input, expected) => {
    expect(parseRupiahInput(input)).toBe(expected);
  });

  it("returns null for an empty field", () => {
    expect(parseRupiahInput("  ")).toBeNull();
  });

  it.each(["1.50.000", "1,500,000", "-1000", "1.500,50", "abc"])(
    "rejects ambiguous or invalid input %s",
    (input) => {
      expect(() => parseRupiahInput(input)).toThrow("angka Rupiah");
    },
  );

  it("formats integer Rupiah for Indonesia", () => {
    expect(formatRupiah(1_500_000n)).toBe("1.500.000");
  });

  it("parses and formats percentages as integer basis points", () => {
    expect(parsePercentageInput("2,5")).toBe(250n);
    expect(parsePercentageInput("2,50")).toBe(250n);
    expect(parsePercentageInput("0,01")).toBe(1n);
    expect(parsePercentageInput("100")).toBe(10_000n);
    expect(formatPercentage(250n)).toBe("2,5");
    expect(formatPercentage(2_500n)).toBe("25");
    expect(formatPercentage(1n)).toBe("0,01");
  });

  it.each(["1.000", "100,001", "-1", "1.5", "01", "2,500", "NaN"])(
    "rejects invalid percentage %s with a structured domain error",
    (input) => {
      expect(() => parsePercentageInput(input)).toThrow(SharedDomainError);
    },
  );

  it("rejects money and formatted results beyond the explicit domain bound", () => {
    expect(() => parseRupiahInput((MAX_RUPIAH + 1n).toString())).toThrow(
      SharedDomainError,
    );
    expect(() => formatRupiah(MAX_RUPIAH + 1n)).toThrow(SharedDomainError);
  });

  it("preserves a signed result for display without using floating point", () => {
    expect(formatRupiah(-1_500_000n)).toBe("-1.500.000");
  });
});
