import { describe, expect, it } from "vitest";
import vectors from "./fixtures/hpp-phase-1-4-math-vectors.json" with {
  type: "json",
};
import {
  calculateHpp,
  HppCalculationError,
  type HppCalculationInput,
} from "./hpp.js";

interface HppFixture {
  readonly id: string;
  readonly input: {
    readonly productionUnits: string;
    readonly materialCostRupiah: string;
    readonly materialWasteBasisPoints: string;
    readonly directLaborRupiah: string;
    readonly otherDirectCostRupiah: string;
    readonly allocations: readonly {
      readonly label: string;
      readonly category: "overhead" | "depreciation";
      readonly method: "batch" | "per_unit" | "driver";
      readonly amountRupiah: string;
      readonly driverName?: string;
      readonly batchDriverUnits?: string;
      readonly totalDriverUnits?: string;
    }[];
    readonly costsComplete: boolean;
  };
  readonly expected: {
    readonly batchRupiah: string;
    readonly perUnitRupiah: string;
    readonly status: "complete" | "provisional";
  };
}

function hydrate(fixture: HppFixture): HppCalculationInput {
  return {
    productionUnits: BigInt(fixture.input.productionUnits),
    materialCostRupiah: BigInt(fixture.input.materialCostRupiah),
    materialWasteBasisPoints: BigInt(fixture.input.materialWasteBasisPoints),
    directLaborRupiah: BigInt(fixture.input.directLaborRupiah),
    otherDirectCostRupiah: BigInt(fixture.input.otherDirectCostRupiah),
    allocations: fixture.input.allocations.map((allocation) => ({
      label: allocation.label,
      category: allocation.category,
      method: allocation.method,
      amountRupiah: BigInt(allocation.amountRupiah),
      ...(allocation.driverName ? { driverName: allocation.driverName } : {}),
      ...(allocation.batchDriverUnits
        ? { batchDriverUnits: BigInt(allocation.batchDriverUnits) }
        : {}),
      ...(allocation.totalDriverUnits
        ? { totalDriverUnits: BigInt(allocation.totalDriverUnits) }
        : {}),
    })),
    costsComplete: fixture.input.costsComplete,
  };
}

describe("calculateHpp", () => {
  it("matches the phase 1.4 independent arithmetic vectors", () => {
    const cases = vectors.cases as readonly HppFixture[];
    expect(cases).toHaveLength(7);
    for (const fixture of cases) {
      const result = calculateHpp(hydrate(fixture));
      expect(result.totals.batchRupiah.toString(), fixture.id).toBe(
        fixture.expected.batchRupiah,
      );
      expect(result.totals.perUnitRupiah.toString(), fixture.id).toBe(
        fixture.expected.perUnitRupiah,
      );
      expect(result.status, fixture.id).toBe(fixture.expected.status);
    }
  });

  it("rejects zero and invalid production quantities", () => {
    const base = hydrate(vectors.cases[0] as HppFixture);
    for (const productionUnits of [0n, -1n, 1_000_000_001n]) {
      expect(() => calculateHpp({ ...base, productionUnits })).toThrowError(
        HppCalculationError,
      );
    }
  });

  it("rejects incomplete or invalid overhead allocation data", () => {
    const base = hydrate(vectors.cases[0] as HppFixture);
    expect(() =>
      calculateHpp({
        ...base,
        allocations: [
          {
            label: "Listrik",
            category: "overhead",
            method: "driver",
            amountRupiah: 1_000n,
            driverName: "jam mesin",
            batchDriverUnits: 5n,
            totalDriverUnits: 0n,
          },
        ],
      }),
    ).toThrow(/penggerak/i);
    expect(() =>
      calculateHpp({
        ...base,
        allocations: [
          {
            label: "",
            category: "overhead",
            method: "batch",
            amountRupiah: 1_000n,
          },
        ],
      }),
    ).toThrow(/nama/i);
  });

  it("rejects 100% material waste and cost overflow", () => {
    const base = hydrate(vectors.cases[0] as HppFixture);
    expect(() =>
      calculateHpp({ ...base, materialWasteBasisPoints: 10_000n }),
    ).toThrow(/susut bahan/i);
    expect(() =>
      calculateHpp({ ...base, directLaborRupiah: 1_000_000_000_000_000_000n }),
    ).toThrow(/batas/i);
  });

  it("keeps each allocation method and category visible in the result", () => {
    const result = calculateHpp(hydrate(vectors.cases[3] as HppFixture));
    expect(result.lines.map((line) => line.method)).toEqual(
      expect.arrayContaining([
        "Alokasi jam mesin: 10 ÷ 50",
        "Alokasi jam mesin: 10 ÷ 100",
      ]),
    );
    expect(result.totals.overheadRupiah).toBe(100_000n);
    expect(result.totals.depreciationRupiah).toBe(100_000n);
    expect(result.method.rounding).toContain("half-away-from-zero");
  });
});
