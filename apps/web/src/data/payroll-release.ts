import {
  validatePayrollRuleData,
  validateRuleVersion,
  type BpjsRuleData,
  type PayrollTaxRuleData,
  type RuleVersion,
  type VersionedPayrollRules,
} from "@jobenapp/engine";

export interface PayrollGoldenFixtureEvidence {
  readonly id: string;
  readonly sourceUrl: string;
  readonly sourceReference: string;
  readonly testCaseId: string;
  readonly testFile: string;
  readonly expectedResult: string;
  readonly preparedBy: string;
  readonly reviewedBy: string;
  readonly reviewedAt: string;
  readonly testPassed: boolean;
  readonly verified: boolean;
}

export interface PayrollPayslipValidationEvidence {
  readonly completed: boolean;
  readonly anonymized: boolean;
  readonly reviewer: string;
  readonly validatedAt: string;
}

export interface PayrollReleaseData {
  readonly taxRules: VersionedPayrollRules<PayrollTaxRuleData> | null;
  readonly bpjsRules: VersionedPayrollRules<BpjsRuleData> | null;
  readonly pph21Fixtures: readonly PayrollGoldenFixtureEvidence[];
  readonly bpjsFixtures: readonly PayrollGoldenFixtureEvidence[];
  readonly payslipValidation: PayrollPayslipValidationEvidence;
}

/**
 * No production rule dataset or reviewed official fixture set is available.
 * Keep the calculation form closed until independently reviewed evidence is
 * supplied here. The synthetic math vectors are deliberately not referenced.
 */
export const payrollReleaseData: PayrollReleaseData = {
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
};

export interface PayrollReadiness {
  readonly rulesReady: boolean;
  readonly pph21FixturesReady: boolean;
  readonly bpjsFixturesReady: boolean;
  readonly fixturesReady: boolean;
  readonly canCalculate: boolean;
  readonly productionReady: boolean;
  readonly pph21FixtureCount: number;
  readonly bpjsFixtureCount: number;
  readonly issues: readonly string[];
}

function isValidFixtureEvidence(
  fixture: PayrollGoldenFixtureEvidence,
): boolean {
  return (
    fixture.id.trim().length > 0 &&
    /^https:\/\/\S+$/i.test(fixture.sourceUrl) &&
    fixture.sourceReference.trim().length > 0 &&
    fixture.testCaseId.trim().length > 0 &&
    fixture.testFile.trim().length > 0 &&
    fixture.expectedResult.trim().length > 0 &&
    fixture.preparedBy.trim().length > 0 &&
    fixture.reviewedBy.trim().length > 0 &&
    fixture.reviewedBy.trim() !== fixture.preparedBy.trim() &&
    /^\d{4}-\d{2}-\d{2}$/.test(fixture.reviewedAt) &&
    fixture.testPassed &&
    fixture.verified
  );
}

function isVerifiedFixtureSet(
  fixtures: readonly PayrollGoldenFixtureEvidence[],
  minimum: number,
): boolean {
  return (
    fixtures.length >= minimum &&
    new Set(fixtures.map((fixture) => fixture.id)).size === fixtures.length &&
    fixtures.every(isValidFixtureEvidence)
  );
}

function isReviewedRule<T>(
  rules: VersionedPayrollRules<T> | null,
  ruleKey: string,
): rules is VersionedPayrollRules<T> {
  if (!rules) return false;
  const version: RuleVersion = rules.version;
  return (
    version.ruleKey === ruleKey &&
    version.status === "published" &&
    validateRuleVersion(version).length === 0
  );
}

export function evaluatePayrollReadiness(
  data: PayrollReleaseData,
): PayrollReadiness {
  const issues: string[] = [];
  const taxRuleMetadataReady = isReviewedRule(
    data.taxRules,
    "payroll.pph21-permanent",
  );
  const bpjsRuleMetadataReady = isReviewedRule(
    data.bpjsRules,
    "payroll.bpjs-employee",
  );
  const ruleDataIssues =
    data.taxRules && data.bpjsRules
      ? validatePayrollRuleData(data.taxRules.data, data.bpjsRules.data)
      : [];
  const rulesReady =
    taxRuleMetadataReady && bpjsRuleMetadataReady && ruleDataIssues.length === 0;

  const pph21FixturesReady = isVerifiedFixtureSet(data.pph21Fixtures, 30);
  const bpjsFixturesReady = isVerifiedFixtureSet(data.bpjsFixtures, 20);
  const pph21FixtureCount = data.pph21Fixtures.filter(isValidFixtureEvidence).length;
  const bpjsFixtureCount = data.bpjsFixtures.filter(isValidFixtureEvidence).length;
  const fixturesReady = pph21FixturesReady && bpjsFixturesReady;
  const canCalculate = rulesReady && fixturesReady;
  const payslipValidationReady =
    data.payslipValidation.completed &&
    data.payslipValidation.anonymized &&
    data.payslipValidation.reviewer.trim().length > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(data.payslipValidation.validatedAt);
  const productionReady = canCalculate && payslipValidationReady;

  if (!rulesReady) {
    issues.push(
      "PPh 21 dan BPJS perlu data aturan lengkap, resmi, bertanggal efektif, dan ditinjau independen sebelum kalkulasi dibuka.",
    );
    issues.push(...ruleDataIssues);
  }
  if (!pph21FixturesReady) {
    issues.push(
      `Fixture PPh 21/TER dengan bukti lengkap: ${pph21FixtureCount}/30 minimum.`,
    );
  }
  if (!bpjsFixturesReady) {
    issues.push(
      `Fixture BPJS dengan bukti lengkap: ${bpjsFixtureCount}/20 minimum.`,
    );
  }
  if (!payslipValidationReady) {
    issues.push(
      "Validasi terhadap slip gaji nyata yang dianonimkan belum selesai; hasil tidak boleh dipakai untuk produksi.",
    );
  }

  return {
    rulesReady,
    pph21FixturesReady,
    bpjsFixturesReady,
    fixturesReady,
    canCalculate,
    productionReady,
    pph21FixtureCount,
    bpjsFixtureCount,
    issues,
  };
}
