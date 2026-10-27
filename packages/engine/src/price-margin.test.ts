import { describe, expect, it } from "vitest";
import vectors from "./fixtures/phase-1-5-price-margin-vectors.json" with {
  type: "json",
};
import {
  calculatePriceMargin,
  PriceMarginCalculationError,
  type PriceMarginInput,
} from "./price-margin.js";

interface Fixture {
  readonly id: string;
  readonly boundary: string;
  readonly input: Record<string, string>;
  readonly expected: Record<string, string>;
}

function hydrate(fixture: Fixture): PriceMarginInput {
  const common = {
    baseCostRupiah: BigInt(fixture.input.baseCostRupiah!),
    discountBasisPoints: BigInt(fixture.input.discountBasisPoints!),
    platformFeeBasisPoints: BigInt(fixture.input.platformFeeBasisPoints!),
    taxBasisPoints: BigInt(fixture.input.taxBasisPoints!),
    fixedSaleCostRupiah: BigInt(fixture.input.fixedSaleCostRupiah!),
  };

  if (fixture.input.mode === "analyze") {
    return {
      ...common,
      mode: "analyze",
      sellingPriceRupiah: BigInt(fixture.input.sellingPriceRupiah!),
    };
  }
  return {
    ...common,
    mode: fixture.input.mode as "margin" | "markup",
    targetBasisPoints: BigInt(fixture.input.targetBasisPoints!),
  };
}

describe("calculatePriceMargin", () => {
  it("matches seven versioned Phase 1.5 math fixtures", () => {
    const fixtures = vectors.cases as readonly Fixture[];
    expect(fixtures).toHaveLength(7);
    expect(vectors.tool).toBe("harga-jual-margin");
    expect(vectors.methodVersion).toBe("1.5.0");

    for (const fixture of fixtures) {
      if (fixture.expected.errorCode) {
        expect(
          () => calculatePriceMargin(hydrate(fixture)),
          fixture.id,
        ).toThrowError(PriceMarginCalculationError);
        try {
          calculatePriceMargin(hydrate(fixture));
        } catch (error) {
          expect((error as PriceMarginCalculationError).code, fixture.id).toBe(
            fixture.expected.errorCode,
          );
        }
        continue;
      }

      const result = calculatePriceMargin(hydrate(fixture));
      expect(result.listedPriceRupiah.toString(), fixture.id).toBe(
        fixture.expected.listedPriceRupiah,
      );
      expect(result.discountRupiah.toString(), fixture.id).toBe(
        fixture.expected.discountRupiah,
      );
      expect(result.netSalesRupiah.toString(), fixture.id).toBe(
        fixture.expected.netSalesRupiah,
      );
      expect(result.platformFeeRupiah.toString(), fixture.id).toBe(
        fixture.expected.platformFeeRupiah,
      );
      expect(result.taxRupiah.toString(), fixture.id).toBe(
        fixture.expected.taxRupiah,
      );
      expect(result.profitRupiah.toString(), fixture.id).toBe(
        fixture.expected.profitRupiah,
      );
      expect(result.actualMarginBasisPoints?.toString() ?? null, fixture.id).toBe(
        fixture.expected.actualMarginBasisPoints === "null"
          ? null
          : fixture.expected.actualMarginBasisPoints,
      );
      expect(result.actualMarkupBasisPoints.toString(), fixture.id).toBe(
        fixture.expected.actualMarkupBasisPoints,
      );
      expect(
        result.warnings.length > 0,
        `${fixture.id}: ${fixture.boundary}`,
      ).toBe(
        [
          "margin-basic-25",
          "zero-margin-with-costs",
          "analysis-loss",
          "markup-price-ceiling",
        ].includes(fixture.id),
      );
    }
  });

  it("rejects undefined margin and cost-rate combinations", () => {
    const base = hydrate(vectors.cases[0] as Fixture);
    expect(() =>
      calculatePriceMargin({ ...base, mode: "margin", targetBasisPoints: 10_000n }),
    ).toThrow(/margin ditambah pajak dan biaya platform/i);
    expect(() =>
      calculatePriceMargin({
        ...base,
        mode: "margin",
        targetBasisPoints: 9_000n,
        platformFeeBasisPoints: 500n,
        taxBasisPoints: 500n,
      }),
    ).toThrow(PriceMarginCalculationError);
  });

  it("rejects zero cost, invalid percentages, and out-of-range money", () => {
    const base = hydrate(vectors.cases[0] as Fixture);
    expect(() =>
      calculatePriceMargin({ ...base, baseCostRupiah: 0n }),
    ).toThrow(/biaya dasar harus lebih besar dari nol/i);
    expect(() =>
      calculatePriceMargin({ ...base, discountBasisPoints: 10_001n }),
    ).toThrow(/diskon/i);
    expect(() =>
      calculatePriceMargin({
        ...base,
        baseCostRupiah: 1_000_000_000_000_000_000n,
      }),
    ).toThrow(/batas Rupiah/i);
  });

  it("keeps user-supplied tax and platform fee bases explicit", () => {
    const result = calculatePriceMargin(
      hydrate(vectors.cases[3] as Fixture),
    );
    expect(result.assumptions.join(" ")).toMatch(/omzet setelah diskon/i);
    expect(result.assumptions.join(" ")).toMatch(/bukan kalkulator pajak/i);
    expect(result.method.rounding).toMatch(/dibulatkan ke atas/i);
  });
});
