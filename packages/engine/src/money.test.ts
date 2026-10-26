import { describe, expect, it } from "vitest";
import { MAX_RUPIAH } from "@jobenapp/shared";
import fixtures from "./fixtures/core-money.json" with { type: "json" };
import {
  calculatePercentage,
  EngineDomainError,
  roundRatio,
  serializeCalculationResult,
  type RoundingMode,
} from "./index.js";

const fixtureInputs = fixtures as {
  id: string;
  methodVersion: string;
  input: {
    amountRupiah: string;
    rateBasisPoints: string;
    rounding: RoundingMode;
  };
  expectedRupiah: string;
}[];

function expectErrorCode(action: () => unknown, code: string): void {
  try {
    action();
  } catch (error) {
    expect(error).toHaveProperty("code", code);
    return;
  }
  throw new Error(`Expected domain error with code ${code}.`);
}

describe("exact integer ratio arithmetic", () => {
  it.each([
    [5n, 2n, "half-away-from-zero", 3n],
    [-5n, 2n, "half-away-from-zero", -3n],
    [4n, 3n, "half-away-from-zero", 1n],
    [-4n, 3n, "floor", -2n],
    [-4n, 3n, "ceiling", -1n],
    [4n, -3n, "floor", -2n],
    [4n, -3n, "ceiling", -1n],
    [12n, 3n, "half-away-from-zero", 4n],
  ] as const)("rounds %s / %s using %s", (n, d, mode, expected) => {
    expect(roundRatio(n, d, mode)).toBe(expected);
  });

  it("rejects division by zero and an unknown runtime rounding mode", () => {
    expectErrorCode(() => roundRatio(1n, 0n, "floor"), "division_by_zero");
    expectErrorCode(
      () => roundRatio(1n, 2n, "truncate" as RoundingMode),
      "invalid_rounding_mode",
    );
  });
});

describe("percentage calculation fixtures", () => {
  it.each(fixtureInputs)("$id", (fixture) => {
    const result = calculatePercentage({
      amountRupiah: BigInt(fixture.input.amountRupiah),
      rateBasisPoints: BigInt(fixture.input.rateBasisPoints),
      rounding: fixture.input.rounding,
      methodVersion: fixture.methodVersion,
    });
    expect(result.resultRupiah.toString()).toBe(fixture.expectedRupiah);
    expect(result.method.version).toBe(fixture.methodVersion);
    expect(result.steps).toHaveLength(2);
    expect(result.warnings).toEqual([]);
  });

  it("gives identical serialized output for identical input and version", () => {
    const input = {
      amountRupiah: 1_500_000n,
      rateBasisPoints: 250n,
      rounding: "half-away-from-zero" as const,
      methodVersion: "core-percentage/1.0.0",
    };
    expect(serializeCalculationResult(calculatePercentage(input))).toBe(
      serializeCalculationResult(calculatePercentage({ ...input })),
    );
  });

  it("keeps floor at or below and ceiling at or above the exact ratio", () => {
    for (let amount = 0n; amount <= 100n; amount += 1n) {
      for (let rate = 0n; rate <= 10_000n; rate += 137n) {
        const floorResult = calculatePercentage({
          amountRupiah: amount,
          rateBasisPoints: rate,
          rounding: "floor",
          methodVersion: "test/1",
        }).resultRupiah;
        const ceilingResult = calculatePercentage({
          amountRupiah: amount,
          rateBasisPoints: rate,
          rounding: "ceiling",
          methodVersion: "test/1",
        }).resultRupiah;
        expect(floorResult * 10_000n).toBeLessThanOrEqual(amount * rate);
        expect(ceilingResult * 10_000n).toBeGreaterThanOrEqual(amount * rate);
      }
    }
  });

  it.each([
    [-1n, 100n, "invalid_amount"],
    [1_000_000_000_000_000_000n, 100n, "amount_out_of_range"],
    [100n, -1n, "invalid_rate"],
    [100n, 10_001n, "invalid_rate"],
  ] as const)("rejects invalid input with code %s", (amount, rate, code) => {
    expectErrorCode(
      () =>
      calculatePercentage({
        amountRupiah: amount,
        rateBasisPoints: rate,
        rounding: "floor",
        methodVersion: "test/1",
      }),
      code,
    );
  });

  it("rejects a missing method version", () => {
    expect(() =>
      calculatePercentage({
        amountRupiah: 10n,
        rateBasisPoints: 100n,
        rounding: "floor",
        methodVersion: "",
      }),
    ).toThrow(EngineDomainError);
  });

  it("rejects non-BigInt amounts and rates at the runtime boundary", () => {
    expectErrorCode(
      () =>
        calculatePercentage({
          amountRupiah: "1000" as unknown as bigint,
          rateBasisPoints: 100n,
          rounding: "floor",
          methodVersion: "test/1",
        }),
      "invalid_amount",
    );
    expectErrorCode(
      () =>
        calculatePercentage({
          amountRupiah: 1000n,
          rateBasisPoints: "100" as unknown as bigint,
          rounding: "floor",
          methodVersion: "test/1",
        }),
      "invalid_rate",
    );
  });

  it("rejects method versions with unsupported characters or excessive length", () => {
    for (const methodVersion of [" ", "v 1", "x".repeat(65)]) {
      expectErrorCode(
        () =>
          calculatePercentage({
            amountRupiah: 1n,
            rateBasisPoints: 0n,
            rounding: "floor",
            methodVersion,
          }),
        "invalid_method_version",
      );
    }
  });

  it("keeps the engine boundary aligned with the shared Rupiah parser", () => {
    expect(
      calculatePercentage({
        amountRupiah: MAX_RUPIAH,
        rateBasisPoints: 0n,
        rounding: "floor",
        methodVersion: "test/1",
      }).resultRupiah,
    ).toBe(0n);
    expectErrorCode(
      () =>
        calculatePercentage({
          amountRupiah: MAX_RUPIAH + 1n,
          rateBasisPoints: 0n,
          rounding: "floor",
          methodVersion: "test/1",
        }),
      "amount_out_of_range",
    );
  });
});
