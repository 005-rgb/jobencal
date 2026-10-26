import { useEffect, useState } from "preact/hooks";
import { validateAdPolicy, type AffiliateRule, type BlockedAdCategories } from "@jobenapp/shared";
import rulesData from "@jobenapp/data/affiliate/rules.example.json";
import blockedData from "@jobenapp/data/ads/blocked-categories.json";
import { getConsent, onChange, type ConsentPreferences } from "../lib/consent.js";

const affiliateRules = rulesData as AffiliateRule[];
const blockedCategories = blockedData as BlockedAdCategories;

interface Props {
  toolKey: string;
  resultRupiah: bigint;
}

function matchesResult(rule: AffiliateRule, result: bigint): boolean {
  const minimum = rule.condition?.minResultRupiah;
  const maximum = rule.condition?.maxResultRupiah;
  if (minimum !== undefined && result < BigInt(minimum)) return false;
  if (maximum !== undefined && result > BigInt(maximum)) return false;
  return true;
}

export default function AffiliateSlot({ toolKey, resultRupiah }: Props) {
  const [consent, setCurrentConsent] = useState<ConsentPreferences | null>(null);

  useEffect(() => {
    setCurrentConsent(getConsent());
    return onChange(setCurrentConsent);
  }, []);

  const policyIssues = validateAdPolicy(affiliateRules, blockedCategories);
  if (policyIssues.length > 0 || consent?.ads !== true) return null;

  const rule = affiliateRules.find(
    (candidate) =>
      candidate.toolKey === toolKey && matchesResult(candidate, resultRupiah),
  );
  if (!rule) return null;

  return (
    <aside class="affiliate-slot" aria-label="Tautan afiliasi">
      <span class="affiliate-label">Tautan afiliasi · contoh</span>
      <a href={rule.destination} rel="sponsored noopener">
        {rule.title}
      </a>
      <p>{rule.description}</p>
    </aside>
  );
}
