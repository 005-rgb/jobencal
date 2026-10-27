import { describe, expect, it } from "vitest";
import vectors from "./fixtures/kpr-phase-1-3-math-vectors.json" with {
  type: "json",
};
import {
  calculateKpr,
  getKprModelLabel,
  KprCalculationError,
  type KprCalculationInput,
  type KprModel,
} from "./kpr.js";

interface FixtureInput {
  principalRupiah: string;
  termMonths: number;
  model: KprModel;
  annualRateBasisPoints: string;
  floatingRate?: {
    fixedMonths: number;
    annualRateBasisPoints: string;
  };
  costs?: Record<string, string>;
  earlyRepayment?: {
    month: number;
    amountRupiah: string;
  };
}

function toCalculationInput(input: FixtureInput): KprCalculationInput {
  return {
    principalRupiah: BigInt(input.principalRupiah),
    termMonths: input.termMonths,
    model: input.model,
    annualRateBasisPoints: BigInt(input.annualRateBasisPoints),
    ...(input.floatingRate
      ? {
          floatingRate: {
            fixedMonths: input.floatingRate.fixedMonths,
            annualRateBasisPoints: BigInt(
              input.floatingRate.annualRateBasisPoints,
            ),
          },
        }
      : {}),
    ...(input.costs
      ? {
          costs: Object.fromEntries(
            Object.entries(input.costs).map(([key, value]) => [
              key,
              BigInt(value),
            ]),
          ),
        }
      : {}),
    ...(input.earlyRepayment
      ? {
          earlyRepayment: {
            month: input.earlyRepayment.month,
            amountRupiah: BigInt(input.earlyRepayment.amountRupiah),
          },
        }
      : {}),
  };
}

function expectCalculationError(
  input: KprCalculationInput,
  code: KprCalculationError["code"],
): void {
  let caught: unknown;
  try {
    calculateKpr(input);
  } catch (error) {
    caught = error;
  }
  expect(caught).toMatchObject({ name: "KprCalculationError", code });
}

describe("Phase 1.3 KPR independent math fixtures", () => {
  it("matches all 15 independent schedule and total vectors", () => {
    expect(vectors.vectors).toHaveLength(15);

    for (const rawFixture of vectors.vectors) {
      const fixture = rawFixture as {
        name: string;
        input: FixtureInput;
        scheduleRows: (string | number | boolean)[][];
        totals: Record<string, string | number>;
      };
      const result = calculateKpr(toCalculationInput(fixture.input));
      const actualRows = fixture.scheduleRows.map((expectedRow) => {
        const month = expectedRow[0];
        expect(typeof month).toBe("number");
        const row = result.schedule[(month as number) - 1];
        expect(row, `${fixture.name} month ${month}`).toBeDefined();
        return [
          row!.month,
          row!.annualRateBasisPoints.toString(),
          row!.openingBalanceRupiah.toString(),
          row!.installmentRupiah.toString(),
          row!.interestRupiah.toString(),
          row!.principalRupiah.toString(),
          row!.extraPrincipalRupiah.toString(),
          row!.closingBalanceRupiah.toString(),
          row!.isFinalAdjustment,
        ];
      });
      const actualTotals = Object.fromEntries(
        Object.entries(result.totals).map(([key, value]) => [
          key,
          typeof value === "bigint" ? value.toString() : value,
        ]),
      );

      expect(actualRows, fixture.name).toEqual(fixture.scheduleRows);
      expect(actualTotals, fixture.name).toEqual(fixture.totals);
      expect(result.schedule).toHaveLength(result.totals.actualTermMonths);
      expect(result.schedule.at(-1)?.closingBalanceRupiah).toBe(0n);
    }
  });

  it("keeps the three amortization models distinct", () => {
    expect(getKprModelLabel("annuity")).toBe("Anuitas");
    expect(getKprModelLabel("flat")).toBe("Flat");
    expect(getKprModelLabel("effective")).toBe("Efektif");

    const outputs = (["annuity", "flat", "effective"] as const).map((model) =>
      calculateKpr({
        principalRupiah: 1_200_000n,
        termMonths: 4,
        model,
        annualRateBasisPoints: 1_200n,
      }).totals.interestRupiah,
    );
    expect(outputs).toEqual([30_150n, 48_000n, 30_000n]);
  });

  it("identifies the corrected formula contract with its own method version", () => {
    const result = calculateKpr({
      principalRupiah: 1_200_000n,
      termMonths: 4,
      model: "flat",
      annualRateBasisPoints: 1_200n,
    });
    expect(result.method.key).toBe("mortgage.kpr-simulation");
    expect(result.method.version).toBe("1.1.0");
    expect(result.method.rateConversion).toBe("nominal-annual-divided-by-12");
    expect(result.method.paymentTiming).toBe("monthly-in-arrears");
  });
});

describe("KPR input boundaries and reconciliation", () => {
  const validInput: KprCalculationInput = {
    principalRupiah: 1_000_000n,
    termMonths: 12,
    model: "annuity",
    annualRateBasisPoints: 1_200n,
  };

  it("accepts the minimum and maximum supported loan, tenor, and rate boundaries", () => {
    expect(
      calculateKpr({
        ...validInput,
        principalRupiah: 1n,
        termMonths: 1,
        annualRateBasisPoints: 0n,
      }).totals.actualTermMonths,
    ).toBe(1);
    expect(
      calculateKpr({
        ...validInput,
        principalRupiah: 999_999_999_999_999_999n,
        termMonths: 1,
        annualRateBasisPoints: 0n,
      }).totals.installmentsRupiah,
    ).toBe(999_999_999_999_999_999n);
    expect(
      calculateKpr({
        ...validInput,
        principalRupiah: 120_000n,
        termMonths: 1,
        annualRateBasisPoints: 10_000n,
      }).schedule[0]?.interestRupiah,
    ).toBe(10_000n);
    expect(
      calculateKpr({
        ...validInput,
        principalRupiah: 360n,
        termMonths: 360,
        annualRateBasisPoints: 0n,
      }).totals.actualTermMonths,
    ).toBe(360);
  });

  it("rejects out-of-range principal, tenor, rate, and model inputs", () => {
    expectCalculationError(
      { ...validInput, principalRupiah: 0n },
      "invalid_principal",
    );
    expectCalculationError(
      { ...validInput, principalRupiah: -1n },
      "invalid_principal",
    );
    expectCalculationError(
      {
        ...validInput,
        principalRupiah: 1_000_000_000_000_000_000n,
      },
      "invalid_principal",
    );
    for (const termMonths of [0, 361, 1.5, Number.NaN]) {
      expectCalculationError({ ...validInput, termMonths }, "invalid_tenor");
    }
    for (const annualRateBasisPoints of [-1n, 10_001n]) {
      expectCalculationError(
        { ...validInput, annualRateBasisPoints },
        "invalid_rate",
      );
    }
    expectCalculationError(
      { ...validInput, model: "unknown" as KprModel },
      "invalid_model",
    );
  });

  it("validates fixed-rate periods and early repayment timing and amount", () => {
    for (const fixedMonths of [0, 12]) {
      expectCalculationError(
        {
          ...validInput,
          floatingRate: {
            fixedMonths,
            annualRateBasisPoints: 2_400n,
          },
        },
        "invalid_floating_period",
      );
    }
    expectCalculationError(
      {
        ...validInput,
        earlyRepayment: { month: 12, amountRupiah: 100n },
      },
      "invalid_early_repayment",
    );
    expectCalculationError(
      {
        ...validInput,
        earlyRepayment: { month: 0, amountRupiah: 100n },
      },
      "invalid_early_repayment",
    );
    expectCalculationError(
      {
        ...validInput,
        earlyRepayment: { month: 2, amountRupiah: 0n },
      },
      "invalid_early_repayment",
    );
  });

  it("rejects invalid or overflowing costs instead of silently changing totals", () => {
    expectCalculationError(
      { ...validInput, costs: { provisionRupiah: -1n } },
      "invalid_cost",
    );
    expectCalculationError(
      {
        ...validInput,
        costs: {
          provisionRupiah: 999_999_999_999_999_999n,
          administrationRupiah: 1n,
        },
      },
      "calculation_overflow",
    );
  });

  it("caps an additional principal payment at the remaining balance and reconciles totals", () => {
    const result = calculateKpr({
      ...validInput,
      termMonths: 4,
      earlyRepayment: {
        month: 1,
        amountRupiah: 999_999_999_999n,
      },
    });
    expect(result.schedule[0]?.extraPrincipalRupiah).toBe(753_719n);
    expect(result.totals.repaidPrincipalRupiah).toBe(1_000_000n);
    expect(result.totals.principalRupiah).toBe(
      result.totals.repaidPrincipalRupiah,
    );
    expect(result.schedule.at(-1)?.closingBalanceRupiah).toBe(0n);
  });
});
