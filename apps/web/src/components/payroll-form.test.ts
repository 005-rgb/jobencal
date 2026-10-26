import { describe, expect, it } from "vitest";
import {
  BPJS_PROGRAM_CODES,
  calculateNetSalary,
  type BpjsProgramCode,
  type BpjsRuleData,
  type PayrollTaxRuleData,
  type VersionedPayrollRules,
} from "@jobenapp/engine";
import type { RuleVersion } from "@jobenapp/engine";
import {
  buildPayrollCalculationInput,
  createPayrollFormDraft,
  getHistoryMonthDraft,
  type MonthDraft,
  type PayrollFormDraft,
} from "./payroll-form.js";

const taxData: PayrollTaxRuleData = {
  terCategoryByTaxStatus: { TEST: "A" },
  ptkpByTaxStatusRupiah: { TEST: 54_000_000n },
  terMonthlyBrackets: {
    A: [{ upperBoundInclusiveGrossRupiah: null, rateBasisPoints: 0n }],
  },
  annualTaxBrackets: [{ upperBoundExclusiveRupiah: null, rateBasisPoints: 0n }],
  jobExpenseRateBasisPoints: 500n,
  jobExpenseMonthlyCapRupiah: 500_000n,
  taxableIncomeRoundingUnitRupiah: 1_000n,
  terWithholdingRounding: "floor",
  annualTaxRounding: "floor",
  annualPeriodTaxRounding: "floor",
  annualTaxDeductionCodes: ["pension"],
};

const bpjsData: BpjsRuleData = {
  programs: Object.fromEntries(
    BPJS_PROGRAM_CODES.map((program: BpjsProgramCode) => [
      program,
      {
        label: program.toUpperCase(),
        wageBaseKey: `base-${program}`,
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
    ]),
  ) as BpjsRuleData["programs"],
};

function version(ruleKey: string): RuleVersion {
  return {
    ruleKey,
    version: "test-only/1",
    status: "published",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    sources: [
      {
        kind: "mathematical-definition",
        title: "Form mapper test",
        url: "https://example.test/not-a-payroll-source",
        reference: "Unit test only; not a published rule.",
      },
    ],
    checkedAt: "2026-01-01",
    review: {
      author: "Test author",
      secondReviewer: "Test reviewer",
      reviewedAt: "2026-01-01",
    },
  };
}

const taxRules: VersionedPayrollRules<PayrollTaxRuleData> = {
  version: version("payroll.pph21-permanent"),
  data: taxData,
};

const bpjsRules: VersionedPayrollRules<BpjsRuleData> = {
  version: version("payroll.bpjs-employee"),
  data: bpjsData,
};

function completeMonth(
  draft: MonthDraft,
  month: number,
  previous = false,
): MonthDraft {
  const compensation = draft.compensation.map((item) => ({
    ...item,
    amountRupiah: "2000000",
    cashPayableRupiah: "2000000",
    taxablePph21Rupiah: "2000000",
    bpjsWageBasesRupiah: Object.fromEntries(
      Object.keys(bpjsData.programs).map((program) => [
        `base-${program}`,
        "2000000",
      ]),
    ),
  }));
  return {
    ...draft,
    compensation,
    pph21WithheldRupiah: previous ? String(1000 * month) : "",
    employeeDeductions: { pension: "0" },
    otherEmployeeDeductionRupiah: "0",
  };
}

function supportedScope(draft: PayrollFormDraft): PayrollFormDraft {
  return {
    ...draft,
    taxSubjectAtYearStart: "yes",
    hasOtherEmployersThisYear: "no",
    employmentEndsHere: "no",
    includesGrossUp: "no",
  };
}

describe("payroll form input mapping", () => {
  it("maps explicit monthly components, participation, and complete prior history", () => {
    const seed = supportedScope(
      createPayrollFormDraft(taxData, bpjsData, new Date(2026, 2, 15)),
    );
    const draft = {
      ...seed,
      taxMonth: "3",
      employmentStartMonth: "1",
      asOfDate: "2026-03-15",
      bpjsParticipation: {
        jkn: "yes",
        jht: "yes",
        jp: "no",
        jkk: "yes",
        jkm: "no",
        jkp: "no",
      } as const,
      currentMonth: completeMonth(seed.currentMonth, 3),
      previousMonths: {
        1: completeMonth(
          getHistoryMonthDraft(seed, 1, taxData, bpjsData),
          1,
          true,
        ),
        2: completeMonth(
          getHistoryMonthDraft(seed, 2, taxData, bpjsData),
          2,
          true,
        ),
      },
    };

    const input = buildPayrollCalculationInput(draft, taxRules, bpjsRules);
    expect(input.previousMonths.map((month) => month.month)).toEqual([1, 2]);
    expect(input.previousMonths[1]?.pph21WithheldRupiah).toBe(2_000n);
    expect(input.currentMonth.compensation[0]?.bpjsWageBasesRupiah["base-jkn"])
      .toBe(2_000_000n);
    expect(input.bpjsParticipation.jp).toBe(false);
    expect(calculateNetSalary(input).gross.cashPayableRupiah).toBe(2_000_000n);
  });

  it("rejects missing prior-month history rather than assuming zero", () => {
    const seed = supportedScope(
      createPayrollFormDraft(taxData, bpjsData, new Date(2026, 1, 15)),
    );
    expect(() =>
      buildPayrollCalculationInput(
        {
          ...seed,
          taxMonth: "2",
          employmentStartMonth: "1",
          asOfDate: "2026-02-15",
          bpjsParticipation: {
            jkn: "yes",
            jht: "yes",
            jp: "yes",
            jkk: "yes",
            jkm: "yes",
            jkp: "yes",
          },
        },
        taxRules,
        bpjsRules,
      ),
    ).toThrow("Riwayat bulan 1 belum diisi.");
  });

  it("requires explicit participation and explicit wage-base classification", () => {
    const seed = supportedScope(
      createPayrollFormDraft(taxData, bpjsData, new Date(2026, 0, 15)),
    );
    const noParticipation = {
      ...seed,
      currentMonth: completeMonth(seed.currentMonth, 1),
    };
    expect(() =>
      buildPayrollCalculationInput(noParticipation, taxRules, bpjsRules),
    ).toThrow("Keikutsertaan BPJS JKN wajib dipilih.");

    const participantChoices = {
      ...seed.bpjsParticipation,
      jkn: "yes",
      jht: "yes",
      jp: "yes",
      jkk: "yes",
      jkm: "yes",
      jkp: "yes",
    } as const;
    const missingBase = {
      ...seed,
      bpjsParticipation: participantChoices,
      currentMonth: {
        ...completeMonth(seed.currentMonth, 1),
        compensation: [
          {
            ...completeMonth(seed.currentMonth, 1).compensation[0]!,
            bpjsWageBasesRupiah: {
              ...completeMonth(seed.currentMonth, 1).compensation[0]!
                .bpjsWageBasesRupiah,
              "base-jkn": "",
            },
          },
        ],
      },
    };
    expect(() =>
      buildPayrollCalculationInput(missingBase, taxRules, bpjsRules),
    ).toThrow("dasar upah base-jkn periode 1 wajib diisi.");
  });

  it("rejects tax-subject changes, job termination, multiple employers, and gross-up", () => {
    const seed = supportedScope(
      createPayrollFormDraft(taxData, bpjsData, new Date(2026, 0, 15)),
    );
    const cases = [
      [
        { taxSubjectAtYearStart: "no" as const },
        "Kasus saat kewajiban pajak dimulai setelah awal tahun belum didukung",
      ],
      [
        { hasOtherEmployersThisYear: "yes" as const },
        "Penghasilan dari beberapa pemberi kerja belum digabungkan",
      ],
      [
        { employmentEndsHere: "yes" as const },
        "Variasi pajak saat pekerjaan berakhir belum diverifikasi",
      ],
      [
        { includesGrossUp: "yes" as const },
        "Perhitungan gross-up belum didukung",
      ],
    ] as const;

    for (const [patch, message] of cases) {
      expect(() =>
        buildPayrollCalculationInput(
          {
            ...seed,
            ...patch,
            bpjsParticipation: {
              jkn: "yes",
              jht: "yes",
              jp: "yes",
              jkk: "yes",
              jkm: "yes",
              jkp: "yes",
            },
            currentMonth: completeMonth(seed.currentMonth, 1),
          },
          taxRules,
          bpjsRules,
        ),
      ).toThrow(message);
    }
  });
});
