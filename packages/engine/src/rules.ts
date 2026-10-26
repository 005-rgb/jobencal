export interface RuleSource {
  readonly kind: "primary" | "mathematical-definition";
  readonly title: string;
  readonly url: string;
  readonly reference: string;
}

export interface RuleVersion {
  readonly ruleKey: string;
  readonly version: string;
  readonly status: "draft" | "published";
  readonly effectiveFrom: string;
  /** Exclusive end date; null means no known end date. */
  readonly effectiveTo: string | null;
  readonly sources: readonly RuleSource[];
  readonly checkedAt: string;
  readonly review: {
    readonly author: string;
    readonly secondReviewer: string;
    readonly reviewedAt: string;
  };
}

export type RuleSelectionErrorCode =
  | "invalid_as_of_date"
  | "rule_not_found"
  | "rule_not_effective"
  | "rule_not_ready"
  | "rule_ambiguous";

export class RuleSelectionError extends Error {
  constructor(
    readonly code: RuleSelectionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RuleSelectionError";
  }
}

function isISODate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
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
  return day <= daysInMonth[month - 1]!;
}

/** Returns reasons a record is unsafe to publish; performs no network checks. */
export function validateRuleVersion(rule: RuleVersion): readonly string[] {
  const issues: string[] = [];
  if (!rule.ruleKey.trim()) issues.push("Kunci aturan wajib diisi.");
  if (!rule.version.trim()) issues.push("Versi aturan wajib diisi.");
  if (!isISODate(rule.effectiveFrom)) {
    issues.push("Tanggal mulai berlaku harus berupa tanggal ISO yang valid.");
  }
  if (rule.effectiveTo !== null && !isISODate(rule.effectiveTo)) {
    issues.push("Tanggal akhir berlaku harus berupa tanggal ISO yang valid.");
  }
  if (
    rule.effectiveTo !== null &&
    isISODate(rule.effectiveFrom) &&
    isISODate(rule.effectiveTo) &&
    rule.effectiveTo <= rule.effectiveFrom
  ) {
    issues.push("Tanggal akhir berlaku harus setelah tanggal mulai.");
  }
  if (!isISODate(rule.checkedAt)) {
    issues.push("Tanggal pemeriksaan sumber wajib berupa tanggal ISO yang valid.");
  }
  if (!rule.sources.length) {
    issues.push("Aturan wajib memiliki sumber atau definisi matematis.");
  }
  for (const source of rule.sources) {
    if (!source.title.trim() || !source.reference.trim()) {
      issues.push("Judul dan bagian sumber wajib dicatat.");
    }
    if (!/^https:\/\/\S+$/i.test(source.url)) {
      issues.push("Setiap sumber wajib memiliki URL HTTPS yang valid.");
    }
  }
  if (
    !rule.sources.some(
      (source) =>
        source.kind === "primary" ||
        source.kind === "mathematical-definition",
    )
  ) {
    issues.push("Sumber primer atau definisi matematis wajib dicantumkan.");
  }
  if (!rule.review.author.trim()) issues.push("Penyusun aturan wajib dicatat.");
  if (!rule.review.secondReviewer.trim()) {
    issues.push("Pemeriksa kedua wajib dicatat.");
  }
  if (
    rule.review.author.trim() &&
    rule.review.author.trim() === rule.review.secondReviewer.trim()
  ) {
    issues.push("Pemeriksa kedua harus berbeda dari penyusun.");
  }
  if (!isISODate(rule.review.reviewedAt)) {
    issues.push("Tanggal tinjau wajib berupa tanggal ISO yang valid.");
  } else if (
    isISODate(rule.checkedAt) &&
    rule.review.reviewedAt < rule.checkedAt
  ) {
    issues.push("Tinjauan harus mencakup pemeriksaan sumber terbaru.");
  }
  return issues;
}

/** Select exactly one published and reviewed version for a caller-supplied date. */
export function selectRuleVersion(
  rules: readonly RuleVersion[],
  ruleKey: string,
  asOfDate: string,
): RuleVersion {
  if (!isISODate(asOfDate)) {
    throw new RuleSelectionError(
      "invalid_as_of_date",
      "Tanggal perhitungan harus berupa tanggal ISO yang valid.",
    );
  }
  const matching = rules.filter((rule) => rule.ruleKey === ruleKey);
  if (!matching.length) {
    throw new RuleSelectionError(
      "rule_not_found",
      `Tidak ada versi untuk aturan ${ruleKey}.`,
    );
  }
  const applicable = matching.filter(
    (rule) =>
      isISODate(rule.effectiveFrom) &&
      rule.effectiveFrom <= asOfDate &&
      (rule.effectiveTo === null ||
        (isISODate(rule.effectiveTo) && asOfDate < rule.effectiveTo)),
  );
  if (!applicable.length) {
    throw new RuleSelectionError(
      "rule_not_effective",
      `Tidak ada versi ${ruleKey} yang berlaku pada ${asOfDate}.`,
    );
  }
  const published = applicable.filter((rule) => rule.status === "published");
  if (!published.length || published.some((rule) => validateRuleVersion(rule).length)) {
    throw new RuleSelectionError(
      "rule_not_ready",
      `Versi ${ruleKey} belum memiliki provenance dan tinjauan yang layak.`,
    );
  }
  if (published.length > 1) {
    throw new RuleSelectionError(
      "rule_ambiguous",
      `Lebih dari satu versi ${ruleKey} berlaku pada ${asOfDate}.`,
    );
  }
  return published[0]!;
}
