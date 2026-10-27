import { describe, expect, it } from "vitest";
import fixtures from "./fixtures/terbilang-phase-1-9-gold-vectors.json" with {
  type: "json",
};
import {
  calculateTerbilang,
  TERBILANG_METHOD_KEY,
  TERBILANG_METHOD_VERSION,
  TerbilangError,
  type TerbilangFormat,
} from "./terbilang.js";

interface GoldenVector {
  readonly id: string;
  readonly value: string;
  readonly format: TerbilangFormat;
  readonly expected: string;
}

interface GoldenFixtureSet {
  readonly tool: string;
  readonly rulesVersion: string;
  readonly checkedOn: string;
  readonly reference: {
    readonly reviewStatus: string;
    readonly reviewer: string | null;
    readonly rounding: string;
    readonly sources: readonly string[];
  };
  readonly boundaryStatusByVector: Record<string, readonly string[]>;
  readonly vectors: readonly GoldenVector[];
}

const goldenFixtures = fixtures as GoldenFixtureSet;

describe("calculateTerbilang", () => {
  it("meets the phase fixture minimum with traceable, independent expected text", () => {
    expect(goldenFixtures.tool).toBe("terbilang");
    expect(goldenFixtures.rulesVersion).toBe(TERBILANG_METHOD_VERSION);
    expect(goldenFixtures.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(goldenFixtures.reference.sources.length).toBeGreaterThanOrEqual(2);
    expect(goldenFixtures.reference.rounding).toContain("Tidak berlaku");
    expect(goldenFixtures.reference.reviewStatus).toBe(
      "independent_review_pending",
    );
    expect(goldenFixtures.reference.reviewer).toBeNull();
    expect(goldenFixtures.vectors.length).toBeGreaterThanOrEqual(40);

    const categorizedIds = Object.values(
      goldenFixtures.boundaryStatusByVector,
    ).flat();
    expect(new Set(categorizedIds).size).toBe(goldenFixtures.vectors.length);
    expect([...categorizedIds].sort()).toEqual(
      goldenFixtures.vectors.map((vector) => vector.id).sort(),
    );

    for (const vector of goldenFixtures.vectors) {
      expect(
        calculateTerbilang({
          value: vector.value,
          format: vector.format,
        }).text,
        vector.id,
      ).toBe(vector.expected);
    }
  });

  it("normalizes grouped numbers without changing their exact fractional digits", () => {
    const result = calculateTerbilang({
      value: "  −001.234,0500  ",
      format: "angka",
    });

    expect(result.input.normalizedValue).toBe("-1234,0500");
    expect(result.text).toBe(
      "minus seribu dua ratus tiga puluh empat koma nol lima nol nol",
    );
    expect(result.rounding.applied).toBe(false);
    expect(result.method).toEqual({
      key: TERBILANG_METHOD_KEY,
      version: TERBILANG_METHOD_VERSION,
    });
  });

  it.each([
    ["", "invalid_input"],
    ["1.23", "invalid_input"],
    ["1,", "invalid_input"],
    ["+1", "invalid_input"],
    ["1.234,56.7", "invalid_input"],
    ["1.000.000.000.000.000.000", "amount_out_of_range"],
    [`1,${"0".repeat(19)}`, "amount_out_of_range"],
    ["0".repeat(65), "amount_out_of_range"],
  ] as const)("rejects invalid or out-of-range input %s", (value, code) => {
    try {
      calculateTerbilang({ value, format: "angka" });
      throw new Error("Expected calculateTerbilang to reject this input.");
    } catch (error) {
      expect(error).toBeInstanceOf(TerbilangError);
      expect((error as TerbilangError).code).toBe(code);
    }
  });

  it("rejects an unsupported output format with a domain error", () => {
    expect(() =>
      calculateTerbilang({
        value: "1",
        format: "currency" as TerbilangFormat,
      }),
    ).toThrowError(
      expect.objectContaining({
        name: "TerbilangError",
        code: "invalid_format",
      }),
    );
  });

  it("normalizes every negative-zero spelling to plain zero", () => {
    expect(calculateTerbilang({ value: "-0,000", format: "angka" })).toMatchObject({
      input: { normalizedValue: "0,000" },
      text: "nol koma nol nol nol",
    });
  });

  it("returns visible assumptions, source metadata, and no invented warnings", () => {
    const result = calculateTerbilang({
      value: "1.000",
      format: "rupiah",
    });

    expect(result.text).toBe("seribu rupiah");
    expect(result.steps).toEqual([
      { key: "integer", label: "Bilangan bulat", result: "seribu rupiah" },
    ]);
    expect(result.assumptions.length).toBeGreaterThanOrEqual(3);
    expect(result.warnings).toEqual([]);
    expect(result.provenance.reviewStatus).toBe("independent_review_pending");
  });
});
