import { describe, expect, it } from "vitest";
import vectors from "./fixtures/payroll-phase-1-1-math-vectors.json" with {
  type: "json",
};
import {
  BPJS_PROGRAM_CODES,
  PAYROLL_BPJS_RULE_KEY,
  PAYROLL_TAX_RULE_KEY,
  calculateNetSalary,
  validatePayrollRuleData,
  type BpjsProgramCode,
  type BpjsRuleData,
  type CalculateNetSalaryInput,
  type ContributionRates,
  type PayrollMonthInput,
  type PayrollTaxRuleData,
  type VersionedPayrollRules,
} from "./index.js";
import type { RuleVersion } from "./rules.js";

interface TaxMathVector {
  readonly id: string;
  readonly gross: string;
  readonly rateBasisPoints: string;
  readonly expected: string;
}

interface BpjsMathVector {
  readonly id: string;
  readonly program: BpjsProgramCode;
  readonly base: string;
  readonly minimum: string | null;
  readonly maximum: string | null;
  readonly employeeRate: string;
  readonly employerRate: string;
  readonly governmentRate: string;
  readonly riskClass: string | null;
  readonly expectedBase: string;
  readonly expectedEmployee: string;
  readonly expectedEmployer: string;
  readonly expectedGovernment: string;
}

const mathVectors = vectors as {
  notice: string;
  taxTer: TaxMathVector[];
  bpjs: BpjsMathVector[];
};

const ZERO_RATES: ContributionRates = {
  employeeBasisPoints: 0n,
  employerBasisPoints: 0n,
  governmentBasisPoints: 0n,
};

function ruleVersion(ruleKey: string): RuleVersion {
  return {
    ruleKey,
    version: "synthetic-math-test/1.0",
    status: "published",
    effectiveFrom: "2026-01-01",
    effectiveTo: "2027-01-01",
    sources: [
      {
        kind: "mathematical-definition",
        title: "Synthetic arithmetic test policy",
        url: "https://example.test/payroll-math",
        reference: "test vectors only; not legislation",
      },
    ],
    checkedAt: "2026-01-01",
    review: {
      author: "Test fixture author",
      secondReviewer: "Test fixture reviewer",
      reviewedAt: "2026-01-01",
    },
  };
}

function makeTaxData(
  overrides: Partial<PayrollTaxRuleData> = {},
): PayrollTaxRuleData {
  return {
    terCategoryByTaxStatus: { TEST: "A", TEST_B: "B" },
    ptkpByTaxStatusRupiah: { TEST: 100_000n, TEST_B: 200_000n },
    terMonthlyBrackets: {
      A: [{ upperBoundInclusiveGrossRupiah: null, rateBasisPoints: 500n }],
      B: [{ upperBoundInclusiveGrossRupiah: null, rateBasisPoints: 1_000n }],
    },
    annualTaxBrackets: [
      { upperBoundExclusiveRupiah: 1_000_000n, rateBasisPoints: 1_000n },
      { upperBoundExclusiveRupiah: null, rateBasisPoints: 2_000n },
    ],
    jobExpenseRateBasisPoints: 500n,
    jobExpenseMonthlyCapRupiah: 10_000n,
    taxableIncomeRoundingUnitRupiah: 1_000n,
    terWithholdingRounding: "half-away-from-zero",
    annualTaxRounding: "half-away-from-zero",
    annualPeriodTaxRounding: "half-away-from-zero",
    annualTaxDeductionCodes: ["pension"],
    ...overrides,
  };
}

function makeTaxRules(
  overrides: Partial<PayrollTaxRuleData> = {},
): VersionedPayrollRules<PayrollTaxRuleData> {
  return {
    version: ruleVersion(PAYROLL_TAX_RULE_KEY),
    data: makeTaxData(overrides),
  };
}

function makeBpjsData(
  override: {
    readonly program?: BpjsProgramCode;
    readonly rates?: ContributionRates;
    readonly minimumBaseRupiah?: bigint | null;
    readonly maximumBaseRupiah?: bigint | null;
    readonly ratesByRiskClass?: Readonly<Record<string, ContributionRates>> | null;
    readonly additionalDependents?: {
      readonly employeeRateBasisPoints: bigint;
      readonly maximumCount: number | null;
      readonly rounding: "half-away-from-zero" | "floor" | "ceiling";
    } | null;
  } = {},
): BpjsRuleData {
  const programs = Object.fromEntries(
    BPJS_PROGRAM_CODES.map((code) => [
      code,
      {
        label: `Synthetic ${code}`,
        wageBaseKey: `base-${code}`,
        minimumBaseRupiah:
          code === override.program
            ? (override.minimumBaseRupiah ?? null)
            : null,
        maximumBaseRupiah:
          code === override.program
            ? (override.maximumBaseRupiah ?? null)
            : null,
        rates: code === override.program ? (override.rates ?? ZERO_RATES) : ZERO_RATES,
        ratesByRiskClass:
          code === override.program
            ? (override.ratesByRiskClass ?? null)
            : null,
        additionalDependents:
          code === override.program
            ? (override.additionalDependents ?? null)
            : null,
        rounding: "half-away-from-zero" as const,
      },
    ]),
  ) as BpjsRuleData["programs"];
  return { programs };
}

function makeBpjsRules(
  override: Parameters<typeof makeBpjsData>[0] = {},
): VersionedPayrollRules<BpjsRuleData> {
  return {
    version: ruleVersion(PAYROLL_BPJS_RULE_KEY),
    data: makeBpjsData(override),
  };
}

function makeMonth(
  month: number,
  amount: bigint,
  deduction: bigint = 0n,
): PayrollMonthInput {
  return {
    month,
    compensation: [
      {
        key: "salary",
        amountRupiah: amount,
        cashPayableRupiah: amount,
        taxablePph21Rupiah: amount,
        bpjsWageBasesRupiah: Object.fromEntries(
          BPJS_PROGRAM_CODES.map((code) => [`base-${code}`, amount]),
        ),
      },
    ],
    employeeDeductions:
      deduction === 0n
        ? []
        : [{ code: "pension", amountRupiah: deduction }],
  };
}

function makeInput(
  overrides: Partial<CalculateNetSalaryInput> = {},
): CalculateNetSalaryInput {
  const taxMonth = overrides.taxMonth ?? 6;
  const taxYear = overrides.taxYear ?? 2026;
  const employmentStartMonth = overrides.employmentStartMonth ?? taxMonth;
  return {
    taxYear,
    taxMonth,
    employmentStartMonth,
    employmentEndMonth: null,
    asOfDate: `${taxYear}-${String(taxMonth).padStart(2, "0")}-15`,
    taxStatusAtYearStart: "TEST",
    bpjsRiskClass: null,
    bpjsParticipation: {
      jkn: true,
      jht: true,
      jp: true,
      jkk: true,
      jkm: true,
      jkp: true,
    },
    jknAdditionalDependents: 0,
    previousMonths: [],
    currentMonth: makeMonth(taxMonth, 100_000n),
    taxRules: makeTaxRules(),
    bpjsRules: makeBpjsRules(),
    ...overrides,
  };
}

function expectPayrollError(
  action: () => unknown,
  code: string,
): void {
  try {
    action();
  } catch (error) {
    expect(error).toHaveProperty("code", code);
    return;
  }
  throw new Error(`Expected payroll domain error with code ${code}.`);
}

describe("Phase 1.1 synthetic math vectors", () => {
  it("validates complete rule datasets without publishing or calculating them", () => {
    expect(validatePayrollRuleData(makeTaxData(), makeBpjsData())).toEqual([]);
    expect(
      validatePayrollRuleData(
        makeTaxData({ taxableIncomeRoundingUnitRupiah: 0n }),
        makeBpjsData(),
      ),
    ).toContain("Aturan PPh 21: Satuan pembulatan PKP harus lebih besar dari nol.");
  });

  it("labels its vectors as non-regulatory, non-publication test data", () => {
    expect(mathVectors.notice).toContain("do not contain official");
  });

  it.each(mathVectors.taxTer)("$id: monthly TER arithmetic", (fixture) => {
    const rate = BigInt(fixture.rateBasisPoints);
    const input = makeInput({
      currentMonth: makeMonth(6, BigInt(fixture.gross)),
      taxRules: makeTaxRules({
        terMonthlyBrackets: {
          A: [{ upperBoundInclusiveGrossRupiah: null, rateBasisPoints: rate }],
          B: [{ upperBoundInclusiveGrossRupiah: null, rateBasisPoints: rate }],
        },
      }),
    });
    expect(
      calculateNetSalary(input).tax.currentWithholdingRupiah.toString(),
    ).toBe(fixture.expected);
  });

  it.each(mathVectors.bpjs)("$id: independent program contribution", (fixture) => {
    const rates: ContributionRates = {
      employeeBasisPoints: BigInt(fixture.employeeRate),
      employerBasisPoints: BigInt(fixture.employerRate),
      governmentBasisPoints: BigInt(fixture.governmentRate),
    };
    const rules = makeBpjsRules({
      program: fixture.program,
      rates,
      minimumBaseRupiah:
        fixture.minimum === null ? null : BigInt(fixture.minimum),
      maximumBaseRupiah:
        fixture.maximum === null ? null : BigInt(fixture.maximum),
      ratesByRiskClass:
        fixture.riskClass === null
          ? null
          : { [fixture.riskClass]: rates },
    });
    const participation = Object.fromEntries(
      BPJS_PROGRAM_CODES.map((code) => [code, code === fixture.program]),
    ) as CalculateNetSalaryInput["bpjsParticipation"];
    const result = calculateNetSalary(
      makeInput({
        currentMonth: makeMonth(6, BigInt(fixture.base)),
        bpjsRiskClass: fixture.riskClass,
        bpjsParticipation: participation,
        bpjsRules: rules,
      }),
    );
    const line = result.bpjs.programs.find(
      (candidate) => candidate.program === fixture.program,
    )!;
    expect(line.contributionBaseRupiah.toString()).toBe(fixture.expectedBase);
    expect(line.employeeRupiah.toString()).toBe(fixture.expectedEmployee);
    expect(line.employerRupiah.toString()).toBe(fixture.expectedEmployer);
    expect(line.governmentRupiah.toString()).toBe(fixture.expectedGovernment);
  });
});

describe("PPh 21 categories, final-month reconciliation, and payroll history", () => {
  it("uses the mapped TER category and the exact upper-bound rule", () => {
    const input = makeInput({
      currentMonth: makeMonth(6, 100_000n),
      taxRules: makeTaxRules({
        terMonthlyBrackets: {
          A: [
            { upperBoundInclusiveGrossRupiah: 100_000n, rateBasisPoints: 100n },
            { upperBoundInclusiveGrossRupiah: null, rateBasisPoints: 200n },
          ],
          B: [{ upperBoundInclusiveGrossRupiah: null, rateBasisPoints: 300n }],
        },
      }),
    });
    const result = calculateNetSalary(input);
    expect(result.tax.category).toBe("A");
    expect(result.tax.currentWithholdingRupiah).toBe(1_000n);
    expect(result.tax.mode).toBe("ter-monthly");
  });

  it("uses the next TER bracket only above the inclusive upper bound", () => {
    const makeResult = (gross: bigint) =>
      calculateNetSalary(
        makeInput({
          currentMonth: makeMonth(6, gross),
          taxRules: makeTaxRules({
            terMonthlyBrackets: {
              A: [
                {
                  upperBoundInclusiveGrossRupiah: 5_400_000n,
                  rateBasisPoints: 0n,
                },
                {
                  upperBoundInclusiveGrossRupiah: null,
                  rateBasisPoints: 25n,
                },
              ],
              B: [
                {
                  upperBoundInclusiveGrossRupiah: null,
                  rateBasisPoints: 0n,
                },
              ],
            },
          }),
        }),
      );

    expect(makeResult(5_400_000n).tax.currentWithholdingRupiah).toBe(0n);
    expect(makeResult(5_400_001n).tax.currentWithholdingRupiah).toBe(13_500n);
  });

  it("does not use a current-year status change instead of the year-start status", () => {
    const result = calculateNetSalary(
      makeInput({
        taxStatusAtYearStart: "TEST_B",
        currentMonth: makeMonth(6, 100_000n),
      }),
    );
    expect(result.tax.category).toBe("B");
    expect(result.tax.currentWithholdingRupiah).toBe(10_000n);
  });

  it("reconciles a full-year employee against progressive annual tax", () => {
    const previousMonths = Array.from({ length: 11 }, (_, index) => ({
      ...makeMonth(index + 1, 100_000n),
      pph21WithheldRupiah: 5_000n,
    }));
    const result = calculateNetSalary(
      makeInput({
        taxMonth: 12,
        employmentStartMonth: 1,
        previousMonths,
        currentMonth: makeMonth(12, 100_000n),
      }),
    );
    expect(result.period.isFinalTaxPeriod).toBe(true);
    expect(result.tax.mode).toBe("annual-final-reconciliation");
    expect(result.tax.jobExpenseDeductionRupiah).toBe(60_000n);
    expect(result.tax.annualizedNetIncomeRupiah).toBe(1_140_000n);
    expect(result.tax.taxableIncomeRupiah).toBe(1_040_000n);
    expect(result.tax.annualTaxRupiah).toBe(108_000n);
    expect(result.tax.priorWithholdingRupiah).toBe(55_000n);
    expect(result.tax.currentWithholdingRupiah).toBe(53_000n);
  });

  it("annualizes and prorates a midyear employment period", () => {
    const previousMonths = [7, 8].map((month) => ({
      ...makeMonth(month, 100_000n),
      pph21WithheldRupiah: 5_000n,
    }));
    const result = calculateNetSalary(
      makeInput({
        taxMonth: 9,
        employmentStartMonth: 7,
        employmentEndMonth: 9,
        previousMonths,
        currentMonth: makeMonth(9, 100_000n),
      }),
    );
    expect(result.period.employmentMonthsInTaxYear).toBe(3);
    expect(result.tax.annualizedNetIncomeRupiah).toBe(1_140_000n);
    expect(result.tax.partYearTaxRupiah).toBe(27_000n);
    expect(result.tax.currentWithholdingRupiah).toBe(17_000n);
  });

  it("preserves a negative final withholding as a refundable overpayment", () => {
    const previousMonths = [7, 8].map((month) => ({
      ...makeMonth(month, 100_000n),
      pph21WithheldRupiah: 20_000n,
    }));
    const result = calculateNetSalary(
      makeInput({
        taxMonth: 9,
        employmentStartMonth: 7,
        employmentEndMonth: 9,
        previousMonths,
        currentMonth: makeMonth(9, 100_000n),
      }),
    );
    expect(result.tax.currentWithholdingRupiah).toBe(-13_000n);
    expect(result.warnings.join(" ")).toContain("kelebihan potong");
  });

  it("only subtracts contribution codes allowed by the versioned tax rule", () => {
    const previousMonths = Array.from({ length: 11 }, (_, index) => ({
      ...makeMonth(index + 1, 100_000n, 1_000n),
      pph21WithheldRupiah: 5_000n,
    }));
    const result = calculateNetSalary(
      makeInput({
        taxMonth: 12,
        employmentStartMonth: 1,
        previousMonths,
        currentMonth: makeMonth(12, 100_000n, 1_000n),
      }),
    );
    expect(result.tax.taxDeductibleContributionsRupiah).toBe(12_000n);
    expect(result.tax.taxableIncomeRupiah).toBe(1_028_000n);
    expect(result.tax.annualTaxRupiah).toBe(105_600n);
    expect(result.tax.currentWithholdingRupiah).toBe(50_600n);
  });

  it("rejects incomplete history instead of treating prior PPh as zero", () => {
    expectPayrollError(
      () =>
        calculateNetSalary(
          makeInput({
            taxMonth: 7,
            employmentStartMonth: 6,
            previousMonths: [],
          }),
        ),
      "incomplete_payroll_history",
    );
  });

  it("rejects tax status without explicit PTKP/category rule data", () => {
    expectPayrollError(
      () =>
        calculateNetSalary(
          makeInput({
            taxStatusAtYearStart: "UNKNOWN",
            currentMonth: makeMonth(6, 100_000n),
          }),
        ),
      "invalid_payroll_input",
    );
  });

  it("rejects a draft rule version before calculating a result", () => {
    const rules = makeTaxRules();
    expectPayrollError(
      () =>
        calculateNetSalary(
          makeInput({
            taxRules: {
              ...rules,
              version: { ...rules.version, status: "draft" },
            },
            currentMonth: makeMonth(6, 100_000n),
          }),
        ),
      "rule_not_ready",
    );
  });

  it("rejects a calculation date from a different payroll month", () => {
    expectPayrollError(
      () =>
        calculateNetSalary(
          makeInput({
            asOfDate: "2026-05-31",
            currentMonth: makeMonth(6, 100_000n),
          }),
        ),
      "invalid_payroll_period",
    );
  });

  it("rejects a TER table with a gap at its last bracket", () => {
    expectPayrollError(
      () =>
        calculateNetSalary(
          makeInput({
            taxRules: makeTaxRules({
              terMonthlyBrackets: {
                A: [
                  {
                    upperBoundInclusiveGrossRupiah: 100_000n,
                    rateBasisPoints: 500n,
                  },
                ],
                B: [{ upperBoundInclusiveGrossRupiah: null, rateBasisPoints: 500n }],
              },
            }),
          }),
        ),
      "invalid_payroll_rules",
    );
  });
});

describe("BPJS separation, caps, and missing classifications", () => {
  it("keeps employee, employer, and government contributions separate", () => {
    const rates: ContributionRates = {
      employeeBasisPoints: 100n,
      employerBasisPoints: 200n,
      governmentBasisPoints: 50n,
    };
    const participation = Object.fromEntries(
      BPJS_PROGRAM_CODES.map((code) => [code, code === "jkn"]),
    ) as CalculateNetSalaryInput["bpjsParticipation"];
    const result = calculateNetSalary(
      makeInput({
        currentMonth: makeMonth(6, 100_000n),
        bpjsParticipation: participation,
        bpjsRules: makeBpjsRules({ program: "jkn", rates }),
      }),
    );
    expect(result.bpjs.employeeTotalRupiah).toBe(1_000n);
    expect(result.bpjs.employerTotalRupiah).toBe(2_000n);
    expect(result.bpjs.governmentTotalRupiah).toBe(500n);
    expect(result.netPayRupiah).toBe(94_000n);
  });

  it("excludes all shares when a program is explicitly not applicable", () => {
    const participation = Object.fromEntries(
      BPJS_PROGRAM_CODES.map((code) => [code, code !== "jkk"]),
    ) as CalculateNetSalaryInput["bpjsParticipation"];
    const result = calculateNetSalary(
      makeInput({
        bpjsParticipation: participation,
        currentMonth: makeMonth(6, 100_000n),
        bpjsRules: makeBpjsRules({
          program: "jkk",
          ratesByRiskClass: { low: { ...ZERO_RATES, employerBasisPoints: 500n } },
        }),
      }),
    );
    expect(result.bpjs.programs.find((line) => line.program === "jkk")).toMatchObject({
      participation: false,
      contributionBaseRupiah: 0n,
      employerRupiah: 0n,
    });
    expect(result.netPayRupiah).toBe(95_000n);
  });

  it("requires a risk class for an active class-rated rule", () => {
    const participation = Object.fromEntries(
      BPJS_PROGRAM_CODES.map((code) => [code, code === "jkk"]),
    ) as CalculateNetSalaryInput["bpjsParticipation"];
    expectPayrollError(
      () =>
        calculateNetSalary(
          makeInput({
            bpjsParticipation: participation,
            bpjsRules: makeBpjsRules({
              program: "jkk",
              ratesByRiskClass: { low: ZERO_RATES },
            }),
          }),
        ),
      "invalid_payroll_input",
    );
  });

  it("requires each component to explicitly classify every BPJS wage base", () => {
    const currentMonth = makeMonth(6, 100_000n);
    const [salary] = currentMonth.compensation;
    expectPayrollError(
      () =>
        calculateNetSalary(
          makeInput({
            currentMonth: {
              ...currentMonth,
              compensation: [
                {
                  ...salary!,
                  bpjsWageBasesRupiah: { "base-jkn": 100_000n },
                },
              ],
            },
          }),
        ),
      "invalid_payroll_input",
    );
  });

  it("allows a complete, named JKK risk class to select the independent rate", () => {
    const participation = Object.fromEntries(
      BPJS_PROGRAM_CODES.map((code) => [code, code === "jkk"]),
    ) as CalculateNetSalaryInput["bpjsParticipation"];
    const result = calculateNetSalary(
      makeInput({
        bpjsRiskClass: "low",
        bpjsParticipation: participation,
        bpjsRules: makeBpjsRules({
          program: "jkk",
          ratesByRiskClass: {
            low: { ...ZERO_RATES, employerBasisPoints: 54n },
            high: { ...ZERO_RATES, employerBasisPoints: 174n },
          },
        }),
        currentMonth: makeMonth(6, 1_000_000n),
      }),
    );
    expect(result.bpjs.programs.find((line) => line.program === "jkk")?.employerRupiah)
      .toBe(5_400n);
  });

  it("adds configured JKN employee contribution for extra dependents", () => {
    const participation = Object.fromEntries(
      BPJS_PROGRAM_CODES.map((code) => [code, code === "jkn"]),
    ) as CalculateNetSalaryInput["bpjsParticipation"];
    const result = calculateNetSalary(
      makeInput({
        jknAdditionalDependents: 2,
        bpjsParticipation: participation,
        bpjsRules: makeBpjsRules({
          program: "jkn",
          rates: { ...ZERO_RATES, employeeBasisPoints: 100n },
          additionalDependents: {
            employeeRateBasisPoints: 100n,
            maximumCount: 3,
            rounding: "half-away-from-zero",
          },
        }),
        currentMonth: makeMonth(6, 100_000n),
      }),
    );
    const jkn = result.bpjs.programs.find((line) => line.program === "jkn")!;
    expect(jkn.baseEmployeeRupiah).toBe(1_000n);
    expect(jkn.additionalDependents).toBe(2);
    expect(jkn.additionalDependentEmployeeRupiah).toBe(2_000n);
    expect(jkn.employeeRupiah).toBe(3_000n);
    expect(result.netPayRupiah).toBe(92_000n);
  });

  it("does not assume an extra-dependent rate when that rule is absent", () => {
    expectPayrollError(
      () =>
        calculateNetSalary(
          makeInput({
            jknAdditionalDependents: 1,
            currentMonth: makeMonth(6, 100_000n),
          }),
        ),
      "invalid_payroll_input",
    );
  });

  it("rejects extra JKN dependents above the versioned maximum", () => {
    expectPayrollError(
      () =>
        calculateNetSalary(
          makeInput({
            jknAdditionalDependents: 2,
            bpjsRules: makeBpjsRules({
              program: "jkn",
              additionalDependents: {
                employeeRateBasisPoints: 100n,
                maximumCount: 1,
                rounding: "half-away-from-zero",
              },
            }),
          }),
        ),
      "invalid_payroll_input",
    );
  });

  it("clamps a positive contribution base to its configured minimum and maximum", () => {
    const result = calculateNetSalary(
      makeInput({
        bpjsParticipation: {
          jkn: true,
          jht: false,
          jp: false,
          jkk: false,
          jkm: false,
          jkp: false,
        },
        bpjsRules: makeBpjsRules({
          program: "jkn",
          rates: { ...ZERO_RATES, employeeBasisPoints: 100n },
          minimumBaseRupiah: 50_000n,
          maximumBaseRupiah: 60_000n,
        }),
        currentMonth: makeMonth(6, 100_000n),
      }),
    );
    expect(result.bpjs.programs[0]?.contributionBaseRupiah).toBe(60_000n);
    expect(result.bpjs.employeeTotalRupiah).toBe(600n);
  });

  it("rejects a rule where the lower wage bound exceeds its cap", () => {
    expectPayrollError(
      () =>
        calculateNetSalary(
          makeInput({
            bpjsRules: makeBpjsRules({
              program: "jkn",
              minimumBaseRupiah: 60_000n,
              maximumBaseRupiah: 50_000n,
            }),
          }),
        ),
      "invalid_payroll_rules",
    );
  });

  it("rejects a missing/invalid participation state rather than assuming inclusion", () => {
    const participation = {
      jkn: true,
      jht: true,
      jp: true,
      jkk: true,
      jkm: true,
    } as CalculateNetSalaryInput["bpjsParticipation"];
    expectPayrollError(
      () =>
        calculateNetSalary(
          makeInput({
            bpjsParticipation: participation,
            currentMonth: makeMonth(6, 100_000n),
          }),
        ),
      "invalid_payroll_input",
    );
  });
});
