import { describe, expect, it } from "vitest";
import { formatRupiah, parseRupiahInput } from "./money.js";

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
});
