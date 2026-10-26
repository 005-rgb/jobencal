import { describe, expect, it } from "vitest";
import rules from "../../../data/affiliate/rules.example.json" with { type: "json" };
import policy from "../../../data/ads/blocked-categories.json" with { type: "json" };
import { validateAdPolicy, type AffiliateRule } from "./ad-policy.js";

describe("validateAdPolicy", () => {
  it("accepts the checked-in example rule without treating it as a real merchant", () => {
    expect(validateAdPolicy(rules as AffiliateRule[], policy)).toEqual([]);
  });

  it.each([
    ["pornography category", { category: "pornografi" }],
    ["gambling category", { category: "perjudian" }],
    ["blocked adult keyword", { title: "Konten dewasa untuk pengguna" }],
    ["blocked gambling keyword", { description: "Taruhan olahraga berhadiah" }],
    ["blocked destination host", { destination: "https://casino.com/promo" }],
    ["blocked subdomain host", { destination: "https://offers.bet365.com/path" }],
  ])("rejects a rule with a forbidden signal: %s", (_name, overrides) => {
    const candidate = {
      ...(rules[0] as AffiliateRule),
      ...overrides,
    } as AffiliateRule;
    expect(validateAdPolicy([candidate], policy).length).toBeGreaterThan(0);
  });

  it("rejects duplicate IDs, unsafe schemes, and inverted result ranges", () => {
    const original = rules[0] as AffiliateRule;
    const invalid = [
      original,
      { ...original },
      {
        ...original,
        id: "bad-url",
        destination: "javascript:alert(1)",
        condition: { minResultRupiah: "20", maxResultRupiah: "10" },
      },
    ];
    const codes = validateAdPolicy(invalid, policy).map((issue) => issue.code);
    expect(codes).toContain("duplicate_rule");
    expect(codes).toContain("invalid_destination");
    expect(codes).toContain("invalid_condition");
  });
});
