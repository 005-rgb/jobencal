import { MAX_RUPIAH } from "@jobenapp/shared";
import { roundRatio, type RoundingMode } from "./money.js";
import {
  selectRuleVersion,
  type RuleVersion,
} from "./rules.js";

export const PAYROLL_TAX_RULE_KEY = "payroll.pph21-permanent";
export const PAYROLL_BPJS_RULE_KEY = "payroll.bpjs-employee";
export const PAYROLL_METHOD_KEY = "payroll.net-salary";

export const BPJS_PROGRAM_CODES = [
  "jkn",
  "jht",
  "jp",
  "jkk",
  "jkm",
  "jkp",
] as const;

export type BpjsProgramCode = (typeof BPJS_PROGRAM_CODES)[number];

export interface VersionedPayrollRules<TData> {
  readonly version: RuleVersion;
  readonly data: TData;
}

export interface TaxBracket {
  /** Upper bound is exclusive; null means the final, unbounded bracket. */
  readonly upperBoundExclusiveRupiah: bigint | null;
  readonly rateBasisPoints: bigint;
}

export interface MonthlyTerBracket {
  /** Upper bound is exclusive; null means the final, unbounded bracket. */
  readonly upperBoundExclusiveGrossRupiah: bigint | null;
  readonly rateBasisPoints: bigint;
}

export interface PayrollTaxRuleData {
  /** Map status pada awal tahun pajak ke kategori tarif TER bulanan. */
  readonly terCategoryByTaxStatus: Readonly<Record<string, string>>;
  readonly ptkpByTaxStatusRupiah: Readonly<Record<string, bigint>>;
  readonly terMonthlyBrackets: Readonly<
    Record<string, readonly MonthlyTerBracket[]>
  >;
  /** Tarif progresif marginal Pasal 17 untuk rekonsiliasi masa terakhir. */
  readonly annualTaxBrackets: readonly TaxBracket[];
  readonly jobExpenseRateBasisPoints: bigint;
  readonly jobExpenseMonthlyCapRupiah: bigint;
  readonly taxableIncomeRoundingUnitRupiah: bigint;
  readonly terWithholdingRounding: RoundingMode;
  readonly annualTaxRounding: RoundingMode;
  readonly annualPeriodTaxRounding: RoundingMode;
  /** Only named contribution codes in this list reduce annual net income. */
  readonly annualTaxDeductionCodes: readonly string[];
}

export interface ContributionRates {
  readonly employeeBasisPoints: bigint;
  readonly employerBasisPoints: bigint;
  readonly governmentBasisPoints: bigint;
}

export interface BpjsProgramRule {
  readonly label: string;
  /** Wage base identifier explicitly supplied on every compensation component. */
  readonly wageBaseKey: string;
  readonly minimumBaseRupiah: bigint | null;
  readonly maximumBaseRupiah: bigint | null;
  readonly rates: ContributionRates;
  /** Used for risk-rated programs such as JKK; when present, riskClass is required. */
  readonly ratesByRiskClass: Readonly<Record<string, ContributionRates>> | null;
  /** JKN employee-funded surcharge for explicitly declared extra dependents. */
  readonly additionalDependents: {
    readonly employeeRateBasisPoints: bigint;
    readonly maximumCount: number | null;
    readonly rounding: RoundingMode;
  } | null;
  readonly rounding: RoundingMode;
}

export interface BpjsRuleData {
  readonly programs: Readonly<Record<BpjsProgramCode, BpjsProgramRule>>;
}

export interface PayrollCompensation {
  readonly key: string;
  /** Total economic value, including taxable non-cash benefits. */
  readonly amountRupiah: bigint;
  /** Cash actually payable before withholding and deductions. */
  readonly cashPayableRupiah: bigint;
  /** PPh 21 gross amount; determined from the rule-backed component classification. */
  readonly taxablePph21Rupiah: bigint;
  /** Explicit wage bases per program; use 0n when a component is excluded. */
  readonly bpjsWageBasesRupiah: Readonly<Record<string, bigint>>;
}

export interface PayrollEmployeeDeduction {
  readonly code: string;
  readonly amountRupiah: bigint;
}

export interface PayrollMonthInput {
  readonly month: number;
  readonly compensation: readonly PayrollCompensation[];
  readonly employeeDeductions: readonly PayrollEmployeeDeduction[];
}

export interface PayrollHistoryMonthInput extends PayrollMonthInput {
  /** Actual PPh 21 withheld in this earlier payroll month. */
  readonly pph21WithheldRupiah: bigint;
}

export interface CalculateNetSalaryInput {
  readonly taxYear: number;
  readonly taxMonth: number;
  /** First month employed by this employer in the tax year, from 1 to 12. */
  readonly employmentStartMonth: number;
  /** Set to taxMonth when employment ends in this month; otherwise null. */
  readonly employmentEndMonth: number | null;
  /** ISO date inside the payroll month; no system clock is read by the engine. */
  readonly asOfDate: string;
  /** Tax status on the first day of the tax year. */
  readonly taxStatusAtYearStart: string;
  /** Required only if an applicable BPJS program has risk-specific rates. */
  readonly bpjsRiskClass: string | null;
  /** Explicit participation for all six BPJS program codes. */
  readonly bpjsParticipation: Readonly<Record<BpjsProgramCode, boolean>>;
  /** Additional JKN family members beyond the coverage in the base contribution. */
  readonly jknAdditionalDependents: number;
  readonly previousMonths: readonly PayrollHistoryMonthInput[];
  readonly currentMonth: PayrollMonthInput;
  readonly taxRules: VersionedPayrollRules<PayrollTaxRuleData>;
  readonly bpjsRules: VersionedPayrollRules<BpjsRuleData>;
}

export type PayrollCalculationErrorCode =
  | "invalid_payroll_input"
  | "invalid_payroll_period"
  | "incomplete_payroll_history"
  | "invalid_payroll_rules"
  | "amount_out_of_range";

export class PayrollCalculationError extends Error {
  constructor(
    readonly code: PayrollCalculationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PayrollCalculationError";
  }
}

export interface BpjsContributionLine {
  readonly program: BpjsProgramCode;
  readonly label: string;
  readonly participation: boolean;
  readonly wageBaseKey: string;
  readonly wageBaseBeforeLimitsRupiah: bigint;
  readonly contributionBaseRupiah: bigint;
  readonly ratesBasisPoints: ContributionRates;
  readonly additionalDependents: number;
  readonly additionalDependentRateBasisPoints: bigint | null;
  readonly additionalDependentEmployeeRupiah: bigint;
  readonly baseEmployeeRupiah: bigint;
  readonly employeeRupiah: bigint;
  readonly employerRupiah: bigint;
  readonly governmentRupiah: bigint;
  readonly rounding: RoundingMode;
}

export interface NetSalaryCalculation {
  readonly method: {
    readonly key: typeof PAYROLL_METHOD_KEY;
    readonly version: "1.1.0";
    readonly taxRule: { readonly key: string; readonly version: string };
    readonly bpjsRule: { readonly key: string; readonly version: string };
  };
  readonly period: {
    readonly taxYear: number;
    readonly taxMonth: number;
    readonly isFinalTaxPeriod: boolean;
    readonly employmentMonthsInTaxYear: number;
  };
  readonly gross: {
    readonly cashPayableRupiah: bigint;
    readonly taxablePph21Rupiah: bigint;
  };
  readonly tax: {
    readonly category: string;
    readonly mode: "ter-monthly" | "annual-final-reconciliation";
    readonly rateBasisPoints: bigint | null;
    readonly currentWithholdingRupiah: bigint;
    readonly priorWithholdingRupiah: bigint;
    readonly annualizedNetIncomeRupiah: bigint | null;
    readonly ptkpRupiah: bigint | null;
    readonly taxableIncomeBeforeRoundingRupiah: bigint | null;
    readonly taxableIncomeRupiah: bigint | null;
    readonly annualTaxRupiah: bigint | null;
    readonly partYearTaxRupiah: bigint | null;
    readonly jobExpenseDeductionRupiah: bigint | null;
    readonly taxDeductibleContributionsRupiah: bigint | null;
    readonly rounding: {
      readonly terWithholding: RoundingMode;
      readonly annualTax: RoundingMode;
      readonly annualPeriodTax: RoundingMode;
      readonly taxableIncomeUnitRupiah: bigint;
    };
  };
  readonly bpjs: {
    readonly programs: readonly BpjsContributionLine[];
    readonly employeeTotalRupiah: bigint;
    readonly employerTotalRupiah: bigint;
    readonly governmentTotalRupiah: bigint;
  };
  readonly otherEmployeeDeductionsRupiah: bigint;
  readonly totalEmployeeDeductionsRupiah: bigint;
  readonly netPayRupiah: bigint;
  readonly assumptions: readonly string[];
  readonly warnings: readonly string[];
}

const RATE_DENOMINATOR = 10_000n;
const MONTHS_PER_YEAR = 12n;
const DEFAULT_EMPLOYMENT_ASSUMPTIONS = [
  "Penghitungan hanya mencakup penghasilan dan pemotongan yang tercatat pada pemberi kerja ini.",
  "Klasifikasi komponen, dasar upah BPJS, status awal tahun, dan keikutsertaan program diberikan secara eksplisit.",
  "Potongan pemberi kerja dan pemerintah tidak mengurangi gaji bersih pegawai.",
] as const;

function fail(
  code: PayrollCalculationErrorCode,
  message: string,
): never {
  throw new PayrollCalculationError(code, message);
}

function assertAmount(
  value: bigint,
  label: string,
  options: { allowNegative?: boolean } = {},
): void {
  if (typeof value !== "bigint" || (!options.allowNegative && value < 0n)) {
    fail("invalid_payroll_input", `${label} harus berupa Rupiah utuh non-negatif.`);
  }
  if (value > MAX_RUPIAH || value < -MAX_RUPIAH) {
    fail("amount_out_of_range", `${label} melampaui batas nominal 18 digit.`);
  }
}

function checkedSum(values: readonly bigint[], label: string): bigint {
  let total = 0n;
  for (const value of values) {
    total += value;
    if (total > MAX_RUPIAH || total < -MAX_RUPIAH) {
      fail("amount_out_of_range", `${label} melampaui batas nominal 18 digit.`);
    }
  }
  return total;
}

function assertRate(rate: bigint, label: string): void {
  if (typeof rate !== "bigint" || rate < 0n || rate > RATE_DENOMINATOR) {
    fail(
      "invalid_payroll_rules",
      `${label} harus berada di antara 0 dan 10.000 basis point.`,
    );
  }
}

function assertMonth(month: number, label: string): void {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    fail("invalid_payroll_period", `${label} harus berupa bulan 1 sampai 12.`);
  }
}

function assertISODate(value: string): void {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    fail("invalid_payroll_period", "Tanggal perhitungan harus berupa tanggal ISO.");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > (days[month - 1] ?? 0)
  ) {
    fail("invalid_payroll_period", "Tanggal perhitungan harus berupa tanggal ISO yang valid.");
  }
}

function assertRoundingMode(mode: RoundingMode, label: string): void {
  if (
    mode !== "half-away-from-zero" &&
    mode !== "floor" &&
    mode !== "ceiling"
  ) {
    fail("invalid_payroll_rules", `${label} memakai metode pembulatan yang tidak dikenal.`);
  }
}

function assertOrderedBrackets<T extends { readonly rateBasisPoints: bigint }>(
  brackets: readonly T[],
  getUpperBound: (bracket: T) => bigint | null,
  label: string,
): void {
  if (!brackets.length) {
    fail("invalid_payroll_rules", `${label} wajib memiliki tabel tarif.`);
  }
  let previous = 0n;
  brackets.forEach((bracket, index) => {
    const upper = getUpperBound(bracket);
    assertRate(bracket.rateBasisPoints, `${label} tarif`);
    if (upper !== null) {
      assertAmount(upper, `${label} ambang`);
      if (upper <= previous) {
        fail("invalid_payroll_rules", `${label} memiliki ambang yang tidak berurutan.`);
      }
      previous = upper;
    } else if (index !== brackets.length - 1) {
      fail("invalid_payroll_rules", `${label} hanya boleh memiliki satu ambang akhir.`);
    }
  });
  if (getUpperBound(brackets[brackets.length - 1]!) !== null) {
    fail("invalid_payroll_rules", `${label} harus mencakup seluruh rentang penghasilan.`);
  }
}

function assertTaxRules(data: PayrollTaxRuleData): void {
  if (
    !data.terCategoryByTaxStatus ||
    !data.ptkpByTaxStatusRupiah ||
    !data.terMonthlyBrackets
  ) {
    fail("invalid_payroll_rules", "Pemetaan status, PTKP, dan tabel TER wajib tersedia.");
  }
  if (typeof data.jobExpenseRateBasisPoints !== "bigint") {
    fail("invalid_payroll_rules", "Tarif biaya jabatan wajib berupa basis point.");
  }
  assertRate(data.jobExpenseRateBasisPoints, "Tarif biaya jabatan");
  assertAmount(data.jobExpenseMonthlyCapRupiah, "Batas biaya jabatan bulanan");
  assertAmount(
    data.taxableIncomeRoundingUnitRupiah,
    "Satuan pembulatan PKP",
  );
  if (data.taxableIncomeRoundingUnitRupiah === 0n) {
    fail("invalid_payroll_rules", "Satuan pembulatan PKP harus lebih besar dari nol.");
  }
  assertRoundingMode(data.terWithholdingRounding, "Pembulatan TER");
  assertRoundingMode(data.annualTaxRounding, "Pembulatan pajak tahunan");
  assertRoundingMode(data.annualPeriodTaxRounding, "Pembulatan pajak bagian tahun");
  assertOrderedBrackets(
    data.annualTaxBrackets,
    (bracket) => bracket.upperBoundExclusiveRupiah,
    "Tarif progresif tahunan",
  );
  for (const [status, category] of Object.entries(data.terCategoryByTaxStatus)) {
    if (!status.trim() || !category.trim()) {
      fail("invalid_payroll_rules", "Status dan kategori TER tidak boleh kosong.");
    }
    const ptkp = data.ptkpByTaxStatusRupiah[status];
    const brackets = data.terMonthlyBrackets[category];
    if (ptkp === undefined || !brackets) {
      fail(
        "invalid_payroll_rules",
        `Status ${status} tidak memiliki PTKP atau tabel TER yang lengkap.`,
      );
    }
    assertAmount(ptkp, `PTKP ${status}`);
    assertOrderedBrackets(
      brackets,
      (bracket) => bracket.upperBoundExclusiveGrossRupiah,
      `Tabel TER ${category}`,
    );
  }
  if (data.annualTaxDeductionCodes.some((code) => !code.trim())) {
    fail("invalid_payroll_rules", "Kode pengurang pajak tahunan tidak boleh kosong.");
  }
}

function assertRates(rates: ContributionRates, label: string): void {
  assertRate(rates.employeeBasisPoints, `${label} porsi pegawai`);
  assertRate(rates.employerBasisPoints, `${label} porsi pemberi kerja`);
  assertRate(rates.governmentBasisPoints, `${label} porsi pemerintah`);
}

function assertBpjsRules(data: BpjsRuleData): void {
  if (!data.programs) {
    fail("invalid_payroll_rules", "Aturan harus mendefinisikan enam program BPJS.");
  }
  for (const code of BPJS_PROGRAM_CODES) {
    const rule = data.programs[code];
    if (!rule || !rule.label.trim() || !rule.wageBaseKey.trim()) {
      fail("invalid_payroll_rules", `Aturan program ${code} tidak lengkap.`);
    }
    for (const [label, amount] of [
      ["batas minimum", rule.minimumBaseRupiah],
      ["batas maksimum", rule.maximumBaseRupiah],
    ] as const) {
      if (amount !== null) assertAmount(amount, `${code} ${label}`);
    }
    if (
      rule.minimumBaseRupiah !== null &&
      rule.maximumBaseRupiah !== null &&
      rule.minimumBaseRupiah > rule.maximumBaseRupiah
    ) {
      fail("invalid_payroll_rules", `Batas upah ${code} tidak valid.`);
    }
    assertRates(rule.rates, `${code}`);
    assertRoundingMode(rule.rounding, `Pembulatan ${code}`);
    if (rule.additionalDependents !== null) {
      if (code !== "jkn") {
        fail(
          "invalid_payroll_rules",
          "Tambahan tanggungan hanya dapat dikonfigurasi untuk JKN.",
        );
      }
      assertRate(
        rule.additionalDependents.employeeRateBasisPoints,
        "Tarif tambahan tanggungan JKN",
      );
      assertRoundingMode(
        rule.additionalDependents.rounding,
        "Pembulatan tambahan tanggungan JKN",
      );
      if (
        rule.additionalDependents.maximumCount !== null &&
        (!Number.isInteger(rule.additionalDependents.maximumCount) ||
          rule.additionalDependents.maximumCount < 0)
      ) {
        fail("invalid_payroll_rules", "Batas jumlah tanggungan JKN tidak valid.");
      }
    }
    if (rule.ratesByRiskClass !== null) {
      const classes = Object.entries(rule.ratesByRiskClass);
      if (!classes.length) {
        fail("invalid_payroll_rules", `Daftar kelas risiko ${code} tidak boleh kosong.`);
      }
      for (const [riskClass, rates] of classes) {
        if (!riskClass.trim()) {
          fail("invalid_payroll_rules", `Kelas risiko ${code} tidak boleh kosong.`);
        }
        assertRates(rates, `${code} kelas ${riskClass}`);
      }
    }
  }
}

function assertRuleVersion(
  version: RuleVersion,
  expectedKey: string,
  asOfDate: string,
): void {
  if (version.ruleKey !== expectedKey) {
    fail(
      "invalid_payroll_rules",
      `Versi aturan ${expectedKey} wajib diberikan secara eksplisit.`,
    );
  }
  selectRuleVersion([version], expectedKey, asOfDate);
}

function validateMonthRecord(
  month: PayrollMonthInput,
  expectedMonth: number,
  bpjsRules: BpjsRuleData,
  label: string,
): { cash: bigint; taxable: bigint; deductibleContributions: bigint } {
  if (month.month !== expectedMonth) {
    fail(
      "incomplete_payroll_history",
      `${label} wajib mencatat bulan ${expectedMonth} secara berurutan.`,
    );
  }
  const compensationKeys = new Set<string>();
  for (const component of month.compensation) {
    if (!component.key.trim() || compensationKeys.has(component.key)) {
      fail("invalid_payroll_input", `${label} memiliki komponen gaji kosong/duplikat.`);
    }
    compensationKeys.add(component.key);
    assertAmount(component.amountRupiah, `${component.key} nilai komponen`);
    assertAmount(component.cashPayableRupiah, `${component.key} nilai tunai`);
    assertAmount(component.taxablePph21Rupiah, `${component.key} bruto PPh 21`);
    if (
      component.cashPayableRupiah > component.amountRupiah ||
      component.taxablePph21Rupiah > component.amountRupiah
    ) {
      fail(
        "invalid_payroll_input",
        `${component.key} nilai tunai dan bruto PPh 21 tidak boleh melebihi nilai komponen.`,
      );
    }
    for (const code of BPJS_PROGRAM_CODES) {
      const wageBaseKey = bpjsRules.programs[code]?.wageBaseKey;
      if (!wageBaseKey || !Object.hasOwn(component.bpjsWageBasesRupiah, wageBaseKey)) {
        fail(
          "invalid_payroll_input",
          `${component.key} harus menyatakan dasar upah ${wageBaseKey ?? code}, termasuk 0 jika dikecualikan.`,
        );
      }
      const base = component.bpjsWageBasesRupiah[wageBaseKey];
      if (base === undefined) {
        fail("invalid_payroll_input", `${component.key} memiliki dasar upah yang tidak valid.`);
      }
      assertAmount(base, `${component.key} dasar upah ${wageBaseKey}`);
      if (base > component.amountRupiah) {
        fail(
          "invalid_payroll_input",
          `${component.key} dasar upah ${wageBaseKey} melebihi nilai komponen.`,
        );
      }
    }
  }
  const deductionCodes = new Set<string>();
  for (const deduction of month.employeeDeductions) {
    if (!deduction.code.trim() || deductionCodes.has(deduction.code)) {
      fail("invalid_payroll_input", `${label} memiliki kode potongan kosong/duplikat.`);
    }
    deductionCodes.add(deduction.code);
    assertAmount(deduction.amountRupiah, `Potongan ${deduction.code}`);
  }
  const cash = checkedSum(
    month.compensation.map((component) => component.cashPayableRupiah),
    `${label} total tunai`,
  );
  const taxable = checkedSum(
    month.compensation.map((component) => component.taxablePph21Rupiah),
    `${label} bruto kena PPh 21`,
  );
  const gross = checkedSum(
    month.compensation.map((component) => component.amountRupiah),
    `${label} total komponen`,
  );
  const deductibleContributions = checkedSum(
    month.employeeDeductions
      .filter((deduction) => deduction.amountRupiah > 0n)
      .map((deduction) => deduction.amountRupiah),
    `${label} total potongan`,
  );
  if (deductibleContributions > gross) {
    fail("invalid_payroll_input", `${label} total potongan melebihi nilai komponen gaji.`);
  }
  return { cash, taxable, deductibleContributions };
}

function chooseBracket<T extends {
  readonly rateBasisPoints: bigint;
}>(
  brackets: readonly T[],
  amount: bigint,
  getUpper: (bracket: T) => bigint | null,
): T {
  const selected = brackets.find((bracket) => {
    const upper = getUpper(bracket);
    return upper === null || amount < upper;
  });
  if (!selected) {
    fail("invalid_payroll_rules", "Tabel tarif tidak mencakup nilai yang dihitung.");
  }
  return selected;
}

function calculateAnnualTax(
  taxableIncome: bigint,
  brackets: readonly TaxBracket[],
  rounding: RoundingMode,
): bigint {
  let lowerBound = 0n;
  let numerator = 0n;
  for (const bracket of brackets) {
    const upperBound =
      bracket.upperBoundExclusiveRupiah === null ||
      bracket.upperBoundExclusiveRupiah > taxableIncome
        ? taxableIncome
        : bracket.upperBoundExclusiveRupiah;
    const taxableSlice =
      upperBound > lowerBound ? upperBound - lowerBound : 0n;
    numerator += taxableSlice * bracket.rateBasisPoints;
    if (bracket.upperBoundExclusiveRupiah === null ||
        taxableIncome < bracket.upperBoundExclusiveRupiah) {
      return roundRatio(numerator, RATE_DENOMINATOR, rounding);
    }
    lowerBound = bracket.upperBoundExclusiveRupiah;
  }
  fail("invalid_payroll_rules", "Tarif pajak tahunan tidak mencakup seluruh lapisan PKP.");
}

function totalAnnualTaxDeduction(
  month: PayrollMonthInput,
  allowedCodes: ReadonlySet<string>,
): bigint {
  return checkedSum(
    month.employeeDeductions
      .filter((deduction) => allowedCodes.has(deduction.code))
      .map((deduction) => deduction.amountRupiah),
    `Iuran pengurang pajak bulan ${month.month}`,
  );
}

function calculateBpjsPrograms(
  input: CalculateNetSalaryInput,
): readonly BpjsContributionLine[] {
  return BPJS_PROGRAM_CODES.map((program) => {
    const rule = input.bpjsRules.data.programs[program];
    const participates = input.bpjsParticipation[program];
    if (typeof participates !== "boolean") {
      fail("invalid_payroll_input", `Keikutsertaan program ${program} wajib dinyatakan.`);
    }
    const additionalCount =
      program === "jkn" ? input.jknAdditionalDependents : 0;
    if (program === "jkn" && !participates && additionalCount > 0) {
      fail(
        "invalid_payroll_input",
        "Jumlah tanggungan tambahan tidak dapat dihitung saat JKN tidak diikuti.",
      );
    }
    const rawWageBase = checkedSum(
      input.currentMonth.compensation.map(
        (component) => component.bpjsWageBasesRupiah[rule.wageBaseKey]!,
      ),
      `Dasar upah ${program}`,
    );
    const wageBase = participates ? rawWageBase : 0n;
    let contributionBase = wageBase;
    if (contributionBase > 0n) {
      if (
        rule.minimumBaseRupiah !== null &&
        contributionBase < rule.minimumBaseRupiah
      ) {
        contributionBase = rule.minimumBaseRupiah;
      }
      if (
        rule.maximumBaseRupiah !== null &&
        contributionBase > rule.maximumBaseRupiah
      ) {
        contributionBase = rule.maximumBaseRupiah;
      }
    }
    let rates = rule.rates;
    if (participates && rule.ratesByRiskClass !== null) {
      if (!input.bpjsRiskClass) {
        fail(
          "invalid_payroll_input",
          `Kelas risiko wajib dipilih untuk program ${program}.`,
        );
      }
      const riskRates = rule.ratesByRiskClass[input.bpjsRiskClass];
      if (!riskRates) {
        fail(
          "invalid_payroll_input",
          `Kelas risiko ${input.bpjsRiskClass} tidak memiliki aturan ${program}.`,
        );
      }
      rates = riskRates;
    }
    let additionalDependentEmployeeRupiah = 0n;
    if (program === "jkn" && additionalCount > 0) {
      const dependentRule = rule.additionalDependents;
      if (!dependentRule) {
        fail(
          "invalid_payroll_input",
          "Aturan tarif tanggungan tambahan JKN belum tersedia.",
        );
      }
      if (
        dependentRule.maximumCount !== null &&
        additionalCount > dependentRule.maximumCount
      ) {
        fail(
          "invalid_payroll_input",
          "Jumlah tanggungan tambahan melebihi batas pada aturan JKN.",
        );
      }
      additionalDependentEmployeeRupiah =
        roundRatio(
          contributionBase * dependentRule.employeeRateBasisPoints,
          RATE_DENOMINATOR,
          dependentRule.rounding,
        ) * BigInt(additionalCount);
      assertAmount(
        additionalDependentEmployeeRupiah,
        "Iuran tanggungan tambahan JKN",
      );
    }
    if (!participates) {
      rates = {
        employeeBasisPoints: 0n,
        employerBasisPoints: 0n,
        governmentBasisPoints: 0n,
      };
    }
    return {
      program,
      label: rule.label,
      participation: participates,
      wageBaseKey: rule.wageBaseKey,
      wageBaseBeforeLimitsRupiah: wageBase,
      contributionBaseRupiah: contributionBase,
      ratesBasisPoints: rates,
      additionalDependents: additionalCount,
      additionalDependentRateBasisPoints:
        rule.additionalDependents?.employeeRateBasisPoints ?? null,
      additionalDependentEmployeeRupiah,
      baseEmployeeRupiah: roundRatio(
        contributionBase * rates.employeeBasisPoints,
        RATE_DENOMINATOR,
        rule.rounding,
      ),
      employeeRupiah: roundRatio(
        contributionBase * rates.employeeBasisPoints,
        RATE_DENOMINATOR,
        rule.rounding,
      ) + additionalDependentEmployeeRupiah,
      employerRupiah: roundRatio(
        contributionBase * rates.employerBasisPoints,
        RATE_DENOMINATOR,
        rule.rounding,
      ),
      governmentRupiah: roundRatio(
        contributionBase * rates.governmentBasisPoints,
        RATE_DENOMINATOR,
        rule.rounding,
      ),
      rounding: rule.rounding,
    };
  });
}

/**
 * Pure Indonesian employee net-salary calculation.
 *
 * This engine intentionally has no embedded PPh 21 or BPJS tariff data. Both
 * complete, published rule versions must be supplied by the caller.
 */
export function calculateNetSalary(
  input: CalculateNetSalaryInput,
): NetSalaryCalculation {
  assertMonth(input.taxMonth, "Bulan pajak");
  assertMonth(input.employmentStartMonth, "Bulan mulai bekerja");
  if (
    !Number.isInteger(input.taxYear) ||
    input.taxYear < 1900 ||
    input.taxYear > 9999
  ) {
    fail("invalid_payroll_period", "Tahun pajak tidak valid.");
  }
  if (input.employmentStartMonth > input.taxMonth) {
    fail("invalid_payroll_period", "Bulan mulai bekerja tidak boleh setelah periode gaji.");
  }
  assertISODate(input.asOfDate);
  if (
    input.asOfDate.slice(0, 4) !== String(input.taxYear) ||
    Number(input.asOfDate.slice(5, 7)) !== input.taxMonth
  ) {
    fail("invalid_payroll_period", "Tanggal aturan harus berada pada bulan dan tahun penggajian.");
  }
  if (!input.taxStatusAtYearStart.trim()) {
    fail("invalid_payroll_input", "Status pajak pada awal tahun wajib diisi.");
  }
  if (
    !Number.isInteger(input.jknAdditionalDependents) ||
    input.jknAdditionalDependents < 0
  ) {
    fail(
      "invalid_payroll_input",
      "Jumlah tanggungan tambahan JKN harus berupa bilangan bulat non-negatif.",
    );
  }
  if (
    input.employmentEndMonth !== null &&
    input.employmentEndMonth !== input.taxMonth
  ) {
    fail(
      "invalid_payroll_period",
      "Bulan akhir kerja harus berupa periode gaji saat ini atau null.",
    );
  }
  const isFinalTaxPeriod =
    input.taxMonth === 12 || input.employmentEndMonth === input.taxMonth;
  const employmentMonthsInTaxYear =
    input.taxMonth - input.employmentStartMonth + 1;
  assertRuleVersion(
    input.taxRules.version,
    PAYROLL_TAX_RULE_KEY,
    input.asOfDate,
  );
  assertRuleVersion(
    input.bpjsRules.version,
    PAYROLL_BPJS_RULE_KEY,
    input.asOfDate,
  );
  assertTaxRules(input.taxRules.data);
  assertBpjsRules(input.bpjsRules.data);
  if (input.previousMonths.length !== employmentMonthsInTaxYear - 1) {
    fail(
      "incomplete_payroll_history",
      "Riwayat gaji dan PPh 21 harus mencakup setiap bulan kerja sebelum periode ini.",
    );
  }
  input.previousMonths.forEach((month, index) => {
    const expectedMonth = input.employmentStartMonth + index;
    validateMonthRecord(
      month,
      expectedMonth,
      input.bpjsRules.data,
      "Riwayat penggajian",
    );
    assertAmount(month.pph21WithheldRupiah, `PPh 21 bulan ${month.month}`);
  });
  const current = validateMonthRecord(
    input.currentMonth,
    input.taxMonth,
    input.bpjsRules.data,
    "Periode gaji saat ini",
  );
  const taxData = input.taxRules.data;
  const category = taxData.terCategoryByTaxStatus[input.taxStatusAtYearStart];
  const terBrackets = category
    ? taxData.terMonthlyBrackets[category]
    : undefined;
  const ptkp = taxData.ptkpByTaxStatusRupiah[input.taxStatusAtYearStart];
  if (!category || !terBrackets || ptkp === undefined) {
    fail(
      "invalid_payroll_input",
      `Status pajak ${input.taxStatusAtYearStart} belum memiliki kategori TER/PTKP pada aturan ini.`,
    );
  }

  let tax: NetSalaryCalculation["tax"];
  if (!isFinalTaxPeriod) {
    const bracket = chooseBracket(
      terBrackets,
      current.taxable,
      (candidate) => candidate.upperBoundExclusiveGrossRupiah,
    );
    const withholding = roundRatio(
      current.taxable * bracket.rateBasisPoints,
      RATE_DENOMINATOR,
      taxData.terWithholdingRounding,
    );
    tax = {
      category,
      mode: "ter-monthly",
      rateBasisPoints: bracket.rateBasisPoints,
      currentWithholdingRupiah: withholding,
      priorWithholdingRupiah: 0n,
      annualizedNetIncomeRupiah: null,
      ptkpRupiah: null,
      taxableIncomeBeforeRoundingRupiah: null,
      taxableIncomeRupiah: null,
      annualTaxRupiah: null,
      partYearTaxRupiah: null,
      jobExpenseDeductionRupiah: null,
      taxDeductibleContributionsRupiah: null,
      rounding: {
        terWithholding: taxData.terWithholdingRounding,
        annualTax: taxData.annualTaxRounding,
        annualPeriodTax: taxData.annualPeriodTaxRounding,
        taxableIncomeUnitRupiah: taxData.taxableIncomeRoundingUnitRupiah,
      },
    };
  } else {
    const periods = [...input.previousMonths, input.currentMonth];
    const annualGrossTaxable = checkedSum(
      periods.map((period) =>
        checkedSum(
          period.compensation.map((component) => component.taxablePph21Rupiah),
          `Bruto kena PPh 21 bulan ${period.month}`,
        ),
      ),
      "Bruto kena PPh 21 bagian tahun",
    );
    const monthlyJobExpenses = periods.map((period) => {
      const monthGross = checkedSum(
        period.compensation.map((component) => component.taxablePph21Rupiah),
        `Bruto kena PPh 21 bulan ${period.month}`,
      );
      const calculated = roundRatio(
        monthGross * taxData.jobExpenseRateBasisPoints,
        RATE_DENOMINATOR,
        taxData.annualTaxRounding,
      );
      return calculated < taxData.jobExpenseMonthlyCapRupiah
        ? calculated
        : taxData.jobExpenseMonthlyCapRupiah;
    });
    const jobExpense = checkedSum(monthlyJobExpenses, "Biaya jabatan bagian tahun");
    const annualTaxDeductionCodes = new Set(
      taxData.annualTaxDeductionCodes,
    );
    const deductibleContributions = checkedSum(
      periods.map((period) =>
        totalAnnualTaxDeduction(period, annualTaxDeductionCodes),
      ),
      "Iuran pengurang pajak bagian tahun",
    );
    const netForEmploymentPeriod =
      annualGrossTaxable - jobExpense - deductibleContributions;
    if (netForEmploymentPeriod < 0n) {
      fail(
        "invalid_payroll_input",
        "Pengurang penghasilan tahunan melebihi bruto kena pajak.",
      );
    }
    const annualizedNetIncome = roundRatio(
      netForEmploymentPeriod * MONTHS_PER_YEAR,
      BigInt(employmentMonthsInTaxYear),
      taxData.annualTaxRounding,
    );
    assertAmount(annualizedNetIncome, "Penghasilan neto disetahunkan");
    const taxableIncomeBeforeRounding =
      annualizedNetIncome > ptkp ? annualizedNetIncome - ptkp : 0n;
    const taxableIncome =
      (taxableIncomeBeforeRounding /
        taxData.taxableIncomeRoundingUnitRupiah) *
      taxData.taxableIncomeRoundingUnitRupiah;
    const annualTax = calculateAnnualTax(
      taxableIncome,
      taxData.annualTaxBrackets,
      taxData.annualTaxRounding,
    );
    assertAmount(annualTax, "PPh 21 setahun");
    const partYearTax = roundRatio(
      annualTax * BigInt(employmentMonthsInTaxYear),
      MONTHS_PER_YEAR,
      taxData.annualPeriodTaxRounding,
    );
    assertAmount(partYearTax, "PPh 21 bagian tahun");
    const priorWithholding = checkedSum(
      input.previousMonths.map((month) => month.pph21WithheldRupiah),
      "PPh 21 yang telah dipotong sebelumnya",
    );
    tax = {
      category,
      mode: "annual-final-reconciliation",
      rateBasisPoints: null,
      currentWithholdingRupiah: partYearTax - priorWithholding,
      priorWithholdingRupiah: priorWithholding,
      annualizedNetIncomeRupiah: annualizedNetIncome,
      ptkpRupiah: ptkp,
      taxableIncomeBeforeRoundingRupiah: taxableIncomeBeforeRounding,
      taxableIncomeRupiah: taxableIncome,
      annualTaxRupiah: annualTax,
      partYearTaxRupiah: partYearTax,
      jobExpenseDeductionRupiah: jobExpense,
      taxDeductibleContributionsRupiah: deductibleContributions,
      rounding: {
        terWithholding: taxData.terWithholdingRounding,
        annualTax: taxData.annualTaxRounding,
        annualPeriodTax: taxData.annualPeriodTaxRounding,
        taxableIncomeUnitRupiah: taxData.taxableIncomeRoundingUnitRupiah,
      },
    };
  }

  const bpjsPrograms = calculateBpjsPrograms(input);
  const employeeBpjs = checkedSum(
    bpjsPrograms.map((program) => program.employeeRupiah),
    "Total iuran BPJS pegawai",
  );
  const employerBpjs = checkedSum(
    bpjsPrograms.map((program) => program.employerRupiah),
    "Total iuran BPJS pemberi kerja",
  );
  const governmentBpjs = checkedSum(
    bpjsPrograms.map((program) => program.governmentRupiah),
    "Total iuran BPJS pemerintah",
  );
  const otherEmployeeDeductions = checkedSum(
    input.currentMonth.employeeDeductions.map(
      (deduction) => deduction.amountRupiah,
    ),
    "Total potongan pegawai selain BPJS",
  );
  const totalEmployeeDeductions = checkedSum(
    [
      tax.currentWithholdingRupiah,
      employeeBpjs,
      otherEmployeeDeductions,
    ],
    "Total potongan pegawai",
  );
  const netPay = current.cash - totalEmployeeDeductions;
  assertAmount(netPay, "Gaji bersih", { allowNegative: true });

  return {
    method: {
      key: PAYROLL_METHOD_KEY,
      version: "1.1.0",
      taxRule: {
        key: input.taxRules.version.ruleKey,
        version: input.taxRules.version.version,
      },
      bpjsRule: {
        key: input.bpjsRules.version.ruleKey,
        version: input.bpjsRules.version.version,
      },
    },
    period: {
      taxYear: input.taxYear,
      taxMonth: input.taxMonth,
      isFinalTaxPeriod,
      employmentMonthsInTaxYear,
    },
    gross: {
      cashPayableRupiah: current.cash,
      taxablePph21Rupiah: current.taxable,
    },
    tax,
    bpjs: {
      programs: bpjsPrograms,
      employeeTotalRupiah: employeeBpjs,
      employerTotalRupiah: employerBpjs,
      governmentTotalRupiah: governmentBpjs,
    },
    otherEmployeeDeductionsRupiah: otherEmployeeDeductions,
    totalEmployeeDeductionsRupiah: totalEmployeeDeductions,
    netPayRupiah: netPay,
    assumptions: [...DEFAULT_EMPLOYMENT_ASSUMPTIONS],
    warnings: isFinalTaxPeriod
      ? [
          "Masa pajak terakhir dapat menghasilkan pemotongan negatif yang menandakan kelebihan potong; penyelesaian/pengembalian mengikuti ketentuan pemotong pajak.",
          "Penghasilan dan kredit pajak dari pemberi kerja lain tidak digabungkan oleh kalkulasi ini.",
        ]
      : [],
  };
}
