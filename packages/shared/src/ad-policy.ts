import { MAX_RUPIAH } from "./money.js";

export interface BlockedAdCategory {
  readonly id: string;
  readonly label: string;
  readonly keywords: readonly string[];
  readonly domains: readonly string[];
}

export interface BlockedAdCategories {
  readonly version: string;
  readonly categories: readonly BlockedAdCategory[];
}

export interface AffiliateRule {
  readonly id: string;
  readonly toolKey: string;
  readonly category: string;
  readonly title: string;
  readonly description?: string;
  readonly destination: string;
  readonly condition?: {
    readonly minResultRupiah?: string;
    readonly maxResultRupiah?: string;
  };
  readonly isExample?: boolean;
}

export interface AdPolicyIssue {
  readonly ruleId: string;
  readonly code:
    | "invalid_rule"
    | "duplicate_rule"
    | "blocked_category"
    | "blocked_keyword"
    | "blocked_domain"
    | "invalid_destination"
    | "invalid_condition";
  readonly message: string;
}

function tokenize(value: string): string[] {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("id-ID")
    .match(/[\p{L}\p{N}]+/gu) ?? [];
}

function containsPhrase(value: string, phrase: string): boolean {
  const source = tokenize(value);
  const target = tokenize(phrase);
  if (!target.length || target.length > source.length) return false;
  return source.some((_, index) =>
    target.every((token, offset) => source[index + offset] === token),
  );
}

function hasSafeDestination(destination: string): boolean {
  if (destination.startsWith("/") && !destination.startsWith("//")) {
    return true;
  }
  try {
    return new URL(destination).protocol === "https:";
  } catch {
    return false;
  }
}

function hostname(destination: string): string | null {
  if (destination.startsWith("/") && !destination.startsWith("//")) return null;
  try {
    return new URL(destination).hostname.toLocaleLowerCase("en-US");
  } catch {
    return null;
  }
}

function isBlockedDomain(host: string, blockedDomain: string): boolean {
  const normalizedDomain = blockedDomain.toLocaleLowerCase("en-US");
  return host === normalizedDomain || host.endsWith(`.${normalizedDomain}`);
}

function isRupiahBound(value: string): boolean {
  if (!/^\d+$/.test(value)) return false;
  try {
    return BigInt(value) <= MAX_RUPIAH;
  } catch {
    return false;
  }
}

/** First-party affiliate safeguard; it cannot replace network dashboard controls. */
export function validateAdPolicy(
  rules: readonly AffiliateRule[],
  policy: BlockedAdCategories,
): readonly AdPolicyIssue[] {
  const issues: AdPolicyIssue[] = [];
  if (!policy.categories.length) {
    issues.push({
      ruleId: "*",
      code: "invalid_rule",
      message: "Daftar kategori terlarang tidak boleh kosong.",
    });
  }
  const seenIds = new Set<string>();

  for (const rule of rules) {
    const ruleId = typeof rule.id === "string" && rule.id.trim() ? rule.id : "?";
    if (
      !rule.id?.trim() ||
      !rule.toolKey?.trim() ||
      !rule.category?.trim() ||
      !rule.title?.trim() ||
      !rule.destination?.trim()
    ) {
      issues.push({
        ruleId,
        code: "invalid_rule",
        message: "Aturan afiliasi wajib memiliki id, alat, kategori, judul, dan tujuan.",
      });
      continue;
    }
    if (seenIds.has(rule.id)) {
      issues.push({
        ruleId,
        code: "duplicate_rule",
        message: `ID aturan afiliasi ${rule.id} digunakan lebih dari sekali.`,
      });
    }
    seenIds.add(rule.id);

    const destination = rule.destination.trim();
    if (!hasSafeDestination(destination)) {
      issues.push({
        ruleId,
        code: "invalid_destination",
        message: "Tujuan afiliasi harus berupa jalur internal atau URL HTTPS.",
      });
    }

    const content = [
      rule.category,
      rule.title,
      rule.description ?? "",
      destination,
    ].join(" ");
    const blockedCategory = policy.categories.find(
      (category) =>
        tokenize(rule.category).join(" ") === tokenize(category.id).join(" ") ||
        tokenize(rule.category).join(" ") === tokenize(category.label).join(" "),
    );
    if (blockedCategory) {
      issues.push({
        ruleId,
        code: "blocked_category",
        message: `Kategori ${blockedCategory.id} dilarang.`,
      });
    }

    for (const category of policy.categories) {
      const keyword = category.keywords.find((item) =>
        containsPhrase(content, item),
      );
      if (keyword) {
        issues.push({
          ruleId,
          code: "blocked_keyword",
          message: `Aturan memuat kata atau frasa terlarang untuk ${category.id}.`,
        });
        break;
      }
    }

    const host = hostname(destination);
    const domainCategory = host
      ? policy.categories.find((category) =>
          category.domains.some((domain) => isBlockedDomain(host, domain)),
        )
      : undefined;
    if (domainCategory) {
      issues.push({
        ruleId,
        code: "blocked_domain",
        message: `Domain tujuan terdaftar pada kategori terlarang ${domainCategory.id}.`,
      });
    }

    const min = rule.condition?.minResultRupiah;
    const max = rule.condition?.maxResultRupiah;
    if (
      (min !== undefined && !isRupiahBound(min)) ||
      (max !== undefined && !isRupiahBound(max)) ||
      (min !== undefined &&
        max !== undefined &&
        isRupiahBound(min) &&
        isRupiahBound(max) &&
        BigInt(min) > BigInt(max))
    ) {
      issues.push({
        ruleId,
        code: "invalid_condition",
        message: "Batas hasil afiliasi harus berupa Rupiah utuh dan berurutan.",
      });
    }
  }

  return issues;
}
