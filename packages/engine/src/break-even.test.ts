import { describe, expect, it } from "vitest";
import vectors from "./fixtures/bep-phase-1-6-math-vectors.json" with {
  type: "json",
};
import {
  BreakEvenCalculationError,
  calculateBreakEven,
  type BreakEvenInput,
} from "./break-even.js";

interface BreakEvenFixture {
  readonly id: string;
  readonly input: {
    readonly fixedCostRupiah: string;
    readonly sellingPricePerUnitRupiah: string;
    readonly variableCostPerUnitRupiah: string;
  };
  readonly expected?: {
    readonly contributionPerUnitRupiah: string;
    readonly unitNumerator: string;
    readonly unitDenominator: string;
    readonly wholeUnits: string;
    readonly salesAtExactBreakEvenRupiah: string;
    readonly salesAtWholeUnitThresholdRupiah: string;
    readonly profitOneUnitBeforeRupiah: string | null;
    readonly profitAtWholeUnitThresholdRupiah: string;
    readonly profitOneUnitAfterRupiah: string;
  };
  readonly expectedError?: string;
}

function hydrate(fixture: BreakEvenFixture): BreakEvenInput {
  return {
    fixedCostRupiah: BigInt(fixture.input.fixedCostRupiah),
    sellingPricePerUnitRupiah: BigInt(
      fixture.input.sellingPricePerUnitRupiah,
    ),
    variableCostPerUnitRupiah: BigInt(
      fixture.input.variableCostPerUnitRupiah,
    ),
  };
}

describe("calculateBreakEven", () => {
  it("matches all independent arithmetic fixtures", () => {
    const cases = vectors.cases as readonly BreakEvenFixture[];
    expect(cases.length).toBeGreaterThanOrEqual(6);

    for (const fixture of cases) {
      if (fixture.expectedError) {
        expect(
          () => calculateBreakEven(hydrate(fixture)),
          fixture.id,
        ).toThrowError(
          expect.objectContaining({ code: fixture.expectedError }),
        );
        continue;
      }

      const result = calculateBreakEven(hydrate(fixture));
      const expected = fixture.expected!;
      expect(result.contributionPerUnitRupiah.toString(), fixture.id).toBe(
        expected.contributionPerUnitRupiah,
      );
      expect(result.breakEvenUnitsExact.numerator.toString(), fixture.id).toBe(
        expected.unitNumerator,
      );
      expect(result.breakEvenUnitsExact.denominator.toString(), fixture.id).toBe(
        expected.unitDenominator,
      );
      expect(result.breakEvenUnitsWhole.toString(), fixture.id).toBe(
        expected.wholeUnits,
      );
      expect(result.salesAtExactBreakEvenRupiah.toString(), fixture.id).toBe(
        expected.salesAtExactBreakEvenRupiah,
      );
      expect(
        result.salesAtWholeUnitThresholdRupiah.toString(),
        fixture.id,
      ).toBe(expected.salesAtWholeUnitThresholdRupiah);
      expect(result.profitOneUnitBeforeRupiah?.toString() ?? null, fixture.id)
        .toBe(expected.profitOneUnitBeforeRupiah);
      expect(
        result.profitAtWholeUnitThresholdRupiah.toString(),
        fixture.id,
      ).toBe(expected.profitAtWholeUnitThresholdRupiah);
      expect(result.profitOneUnitAfterRupiah.toString(), fixture.id).toBe(
        expected.profitOneUnitAfterRupiah,
      );
    }
  });

  it("rejects zero price and negative costs with explicit domain errors", () => {
    const base = hydrate(vectors.cases[0] as BreakEvenFixture);
    expect(() =>
      calculateBreakEven({ ...base, sellingPricePerUnitRupiah: 0n }),
    ).toThrowError(
      expect.objectContaining({ code: "invalid_selling_price" }),
    );
    expect(() =>
      calculateBreakEven({ ...base, fixedCostRupiah: -1n }),
    ).toThrowError(expect.objectContaining({ code: "invalid_cost" }));
    expect(() =>
      calculateBreakEven({ ...base, variableCostPerUnitRupiah: -1n }),
    ).toThrowError(expect.objectContaining({ code: "invalid_cost" }));
  });

  it("rejects money above the supported limit and output overflow", () => {
    const base = hydrate(vectors.cases[0] as BreakEvenFixture);
    expect(() =>
      calculateBreakEven({
        ...base,
        fixedCostRupiah: 1_000_000_000_000_000_000n,
      }),
    ).toThrowError(BreakEvenCalculationError);

    expect(() =>
      calculateBreakEven({
        fixedCostRupiah: 999_999_999_999_999_999n,
        sellingPricePerUnitRupiah: 999_999_999_999_999_999n,
        variableCostPerUnitRupiah: 999_999_999_999_999_998n,
      }),
    ).toThrowError(
      expect.objectContaining({ code: "calculation_overflow" }),
    );
  });

  it("preserves the break-even and contribution ordering as costs vary", () => {
    const base = hydrate(vectors.cases[0] as BreakEvenFixture);
    const lowerFixed = calculateBreakEven({
      ...base,
      fixedCostRupiah: 80_000n,
    });
    const higherFixed = calculateBreakEven({
      ...base,
      fixedCostRupiah: 120_000n,
    });
    const higherVariable = calculateBreakEven({
      ...base,
      variableCostPerUnitRupiah: 35_000n,
    });

    expect(lowerFixed.breakEvenUnitsWhole).toBeLessThan(
      higherFixed.breakEvenUnitsWhole,
    );
    expect(higherVariable.contributionPerUnitRupiah).toBeLessThan(
      base.sellingPricePerUnitRupiah - base.variableCostPerUnitRupiah,
    );
    expect(
      higherVariable.breakEvenUnitsWhole,
    ).toBeGreaterThanOrEqual(lowerFixed.breakEvenUnitsWhole);
  });
});
