import { describe, expect, it } from "vitest";
import {
  RuleSelectionError,
  selectRuleVersion,
  validateRuleVersion,
  type RuleVersion,
} from "./index.js";

const readyRule: RuleVersion = {
  ruleKey: "test.rule",
  version: "1.0.0",
  status: "published",
  effectiveFrom: "2026-01-01",
  effectiveTo: "2027-01-01",
  sources: [
    {
      kind: "mathematical-definition",
      title: "Internal test definition",
      url: "https://example.test/definition",
      reference: "fixture arithmetic",
    },
  ],
  checkedAt: "2026-01-02",
  review: {
    author: "Author A",
    secondReviewer: "Reviewer B",
    reviewedAt: "2026-01-03",
  },
};

function expectErrorCode(action: () => unknown, code: string): void {
  try {
    action();
  } catch (error) {
    expect(error).toHaveProperty("code", code);
    return;
  }
  throw new Error(`Expected rule error with code ${code}.`);
}

describe("versioned rule provenance", () => {
  it("selects one published version at the requested effective date", () => {
    expect(selectRuleVersion([readyRule], "test.rule", "2026-06-01")).toBe(
      readyRule,
    );
  });

  it("treats the end date as exclusive and requires an explicit date", () => {
    expectErrorCode(
      () => selectRuleVersion([readyRule], "test.rule", "2027-01-01"),
      "rule_not_effective",
    );
    expect(() =>
      selectRuleVersion([readyRule], "test.rule", "2026-02-30"),
    ).toThrow(RuleSelectionError);
    expectErrorCode(
      () => selectRuleVersion([readyRule], "test.rule", "not-a-date"),
      "invalid_as_of_date",
    );
  });

  it("does not select drafts or published rules without second review", () => {
    const draft = { ...readyRule, status: "draft" as const };
    const unreviewed = {
      ...readyRule,
      review: { ...readyRule.review, secondReviewer: "" },
    };
    expect(validateRuleVersion(unreviewed)).toContain(
      "Pemeriksa kedua wajib dicatat.",
    );
    expectErrorCode(
      () => selectRuleVersion([draft], "test.rule", "2026-06-01"),
      "rule_not_ready",
    );
    expectErrorCode(
      () => selectRuleVersion([unreviewed], "test.rule", "2026-06-01"),
      "rule_not_ready",
    );
  });

  it("rejects overlapping published versions rather than silently choosing one", () => {
    const overlapping = { ...readyRule, version: "1.1.0" };
    expectErrorCode(
      () =>
        selectRuleVersion(
        [readyRule, overlapping],
        "test.rule",
        "2026-06-01",
      ),
      "rule_ambiguous",
    );
  });

  it("reports missing rules and absent effective periods explicitly", () => {
    expectErrorCode(
      () => selectRuleVersion([], "test.rule", "2026-06-01"),
      "rule_not_found",
    );
    expectErrorCode(
      () => selectRuleVersion([readyRule], "test.rule", "2025-12-31"),
      "rule_not_effective",
    );
  });

  it("rejects stale review, invalid dates, and non-HTTPS references", () => {
    const invalid: RuleVersion = {
      ...readyRule,
      effectiveTo: "2025-01-01",
      sources: [{ ...readyRule.sources[0]!, url: "http://example.test" }],
      review: { ...readyRule.review, reviewedAt: "2026-01-01" },
    };
    expect(validateRuleVersion(invalid).length).toBeGreaterThanOrEqual(3);
  });

  it("validates every required provenance field and calendar boundary", () => {
    const incomplete: RuleVersion = {
      ...readyRule,
      ruleKey: " ",
      version: " ",
      effectiveFrom: "2026-02-29",
      effectiveTo: "bad-date",
      sources: [],
      checkedAt: "bad-date",
      review: {
        author: " ",
        secondReviewer: " ",
        reviewedAt: "bad-date",
      },
    };
    const issues = validateRuleVersion(incomplete);
    expect(issues).toContain("Kunci aturan wajib diisi.");
    expect(issues).toContain("Versi aturan wajib diisi.");
    expect(issues).toContain(
      "Tanggal mulai berlaku harus berupa tanggal ISO yang valid.",
    );
    expect(issues).toContain("Tanggal akhir berlaku harus berupa tanggal ISO yang valid.");
    expect(issues).toContain("Aturan wajib memiliki sumber atau definisi matematis.");
    expect(issues).toContain("Tanggal pemeriksaan sumber wajib berupa tanggal ISO yang valid.");
    expect(issues).toContain("Penyusun aturan wajib dicatat.");
    expect(issues).toContain("Pemeriksa kedua wajib dicatat.");
    expect(issues).toContain("Tanggal tinjau wajib berupa tanggal ISO yang valid.");
  });

  it("requires a meaningful HTTPS reference and a different second reviewer", () => {
    const incompleteSource: RuleVersion = {
      ...readyRule,
      sources: [
        {
          kind: "secondary" as RuleVersion["sources"][number]["kind"],
          title: " ",
          url: "http://example.test/source",
          reference: " ",
        },
      ],
      review: {
        author: "Same reviewer",
        secondReviewer: "Same reviewer",
        reviewedAt: "2026-01-03",
      },
    };
    const issues = validateRuleVersion(incompleteSource);
    expect(issues).toContain("Judul dan bagian sumber wajib dicatat.");
    expect(issues).toContain("Setiap sumber wajib memiliki URL HTTPS yang valid.");
    expect(issues).toContain("Sumber primer atau definisi matematis wajib dicantumkan.");
    expect(issues).toContain("Pemeriksa kedua harus berbeda dari penyusun.");
  });

  it("supports a verified leap-day rule with no known end date", () => {
    const leapRule: RuleVersion = {
      ...readyRule,
      effectiveFrom: "2024-02-29",
      effectiveTo: null,
      checkedAt: "2024-02-29",
      review: {
        ...readyRule.review,
        reviewedAt: "2024-03-01",
      },
    };
    expect(validateRuleVersion(leapRule)).toEqual([]);
    expect(selectRuleVersion([leapRule], "test.rule", "2026-06-01")).toBe(
      leapRule,
    );
  });

  it("reports a missing source key even when other rule records exist", () => {
    expectErrorCode(
      () => selectRuleVersion([readyRule], "different.rule", "2026-06-01"),
      "rule_not_found",
    );
  });
});
