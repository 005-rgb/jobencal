import { describe, expect, it } from "vitest";
import type {
  BpjsRuleData,
  PayrollTaxRuleData,
  RuleVersion,
} from "@jobenapp/engine";
import {
  evaluatePayrollReadiness,
  type PayrollGoldenFixtureEvidence,
  type PayrollReleaseData,
} from "./payroll-release.js";

function reviewedRule(
  ruleKey: string,
): RuleVersion {
  return {
    ruleKey,
    version: "reviewed-test/1",
    status: "published",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    sources: [
      {
        kind: "primary",
        title: "Test source",
        url: "https://example.test/payroll",
        reference: "test only",
      },
    ],
    checkedAt: "2026-01-02",
    review: {
      author: "Author",
      secondReviewer: "Independent reviewer",
      reviewedAt: "2026-01-02",
    },
  };
}

function fixtureEvidence(id: string): PayrollGoldenFixtureEvidence {
  return {
    id,
    sourceUrl: "https://example.test/fixture",
    sourceReference: "Test only; not a real tax or BPJS fixture.",
    testCaseId: `case-${id}`,
    testFile: "payroll-release.test.ts",
    expectedResult: "1000",
    preparedBy: "Author",
    reviewedBy: "Independent reviewer",
    reviewedAt: "2026-01-02",
    testPassed: true,
    verified: true,
  };
}

const taxData: PayrollTaxRuleData = {
  terCategoryByTaxStatus: { TEST: "A" },
  ptkpByTaxStatusRupiah: { TEST: 0n },
  terMonthlyBrackets: {
    A: [{ upperBoundInclusiveGrossRupiah: null, rateBasisPoints: 0n }],
  },
  annualTaxBrackets: [{ upperBoundExclusiveRupiah: null, rateBasisPoints: 0n }],
  jobExpenseRateBasisPoints: 0n,
  jobExpenseMonthlyCapRupiah: 0n,
  taxableIncomeRoundingUnitRupiah: 1n,
  terWithholdingRounding: "floor",
  annualTaxRounding: "floor",
  annualPeriodTaxRounding: "floor",
  annualTaxDeductionCodes: [],
};

const bpjsData: BpjsRuleData = {
  programs: {
    jkn: {
      label: "JKN",
      wageBaseKey: "base-jkn",
      minimumBaseRupiah: null,
      maximumBaseRupiah: null,
      rates: {
        employeeBasisPoints: 0n,
        employerBasisPoints: 0n,
        governmentBasisPoints: 0n,
      },
      ratesByRiskClass: null,
      additionalDependents: null,
      rounding: "floor",
    },
    jht: {
      label: "JHT",
      wageBaseKey: "base-jht",
      minimumBaseRupiah: null,
      maximumBaseRupiah: null,
      rates: {
        employeeBasisPoints: 0n,
        employerBasisPoints: 0n,
        governmentBasisPoints: 0n,
      },
      ratesByRiskClass: null,
      additionalDependents: null,
      rounding: "floor",
    },
    jp: {
      label: "JP",
      wageBaseKey: "base-jp",
      minimumBaseRupiah: null,
      maximumBaseRupiah: null,
      rates: {
        employeeBasisPoints: 0n,
        employerBasisPoints: 0n,
        governmentBasisPoints: 0n,
      },
      ratesByRiskClass: null,
      additionalDependents: null,
      rounding: "floor",
    },
    jkk: {
      label: "JKK",
      wageBaseKey: "base-jkk",
      minimumBaseRupiah: null,
      maximumBaseRupiah: null,
      rates: {
        employeeBasisPoints: 0n,
        employerBasisPoints: 0n,
        governmentBasisPoints: 0n,
      },
      ratesByRiskClass: null,
      additionalDependents: null,
      rounding: "floor",
    },
    jkm: {
      label: "JKM",
      wageBaseKey: "base-jkm",
      minimumBaseRupiah: null,
      maximumBaseRupiah: null,
      rates: {
        employeeBasisPoints: 0n,
        employerBasisPoints: 0n,
        governmentBasisPoints: 0n,
      },
      ratesByRiskClass: null,
      additionalDependents: null,
      rounding: "floor",
    },
    jkp: {
      label: "JKP",
      wageBaseKey: "base-jkp",
      minimumBaseRupiah: null,
      maximumBaseRupiah: null,
      rates: {
        employeeBasisPoints: 0n,
        employerBasisPoints: 0n,
        governmentBasisPoints: 0n,
      },
      ratesByRiskClass: null,
      additionalDependents: null,
      rounding: "floor",
    },
  },
};

function readyEvidence(): PayrollReleaseData {
  return {
    taxRules: {
      version: reviewedRule("payroll.pph21-permanent"),
      data: taxData,
    },
    bpjsRules: {
      version: reviewedRule("payroll.bpjs-employee"),
      data: bpjsData,
    },
    pph21Fixtures: Array.from({ length: 30 }, (_, index) =>
      fixtureEvidence(`pph-${index + 1}`),
    ),
    bpjsFixtures: Array.from({ length: 20 }, (_, index) =>
      fixtureEvidence(`bpjs-${index + 1}`),
    ),
    payslipValidation: {
      completed: false,
      anonymized: true,
      reviewer: "",
      validatedAt: "",
    },
  };
}

describe("payroll release gate", () => {
  it("keeps the calculator closed when rule datasets are absent", () => {
    const readiness = evaluatePayrollReadiness({
      taxRules: null,
      bpjsRules: null,
      pph21Fixtures: [],
      bpjsFixtures: [],
      payslipValidation: {
        completed: false,
        anonymized: true,
        reviewer: "",
        validatedAt: "",
      },
    });

    expect(readiness.canCalculate).toBe(false);
    expect(readiness.productionReady).toBe(false);
    expect(readiness.issues).toHaveLength(4);
  });

  it("requires both reviewed rule versions and all 50 reviewed sourced fixtures", () => {
    const data = readyEvidence();
    expect(evaluatePayrollReadiness(data)).toMatchObject({
      rulesReady: true,
      fixturesReady: true,
      canCalculate: true,
      productionReady: false,
    });

    expect(
      evaluatePayrollReadiness({
        ...data,
        bpjsFixtures: data.bpjsFixtures.slice(0, 19),
      }).canCalculate,
    ).toBe(false);
  });

  it("does not allow synthetic, unsourced, or same-author fixtures to open the gate", () => {
    const data = readyEvidence();
    const invalidFixture = {
      ...fixtureEvidence("synthetic"),
      sourceUrl: "",
      preparedBy: "Reviewer",
      verified: false,
    };
    expect(
      evaluatePayrollReadiness({
        ...data,
        pph21Fixtures: [
          ...data.pph21Fixtures.slice(0, -1),
          invalidFixture,
        ],
      }).canCalculate,
    ).toBe(false);
  });

  it("requires anonymized real-payroll validation before production readiness", () => {
    const data = readyEvidence();
    const beforeSlipValidation = evaluatePayrollReadiness(data);
    expect(beforeSlipValidation.canCalculate).toBe(true);
    expect(beforeSlipValidation.productionReady).toBe(false);

    const afterSlipValidation = evaluatePayrollReadiness({
      ...data,
      payslipValidation: {
        completed: true,
        anonymized: true,
        reviewer: "Independent payroll reviewer",
        validatedAt: "2026-05-01",
      },
    });
    expect(afterSlipValidation.productionReady).toBe(true);
  });
});
