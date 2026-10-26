import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateAdPolicy } from "@jobenapp/shared";

const root = process.cwd();
const policyPath = resolve(root, "data/ads/blocked-categories.json");
const affiliateDirectory = resolve(root, "data/affiliate");
const policy = JSON.parse(await readFile(policyPath, "utf8"));
const ruleFiles = (await readdir(affiliateDirectory))
  .filter((file) => file.endsWith(".json"))
  .sort();

let failed = false;
for (const file of ruleFiles) {
  const rules = JSON.parse(
    await readFile(resolve(affiliateDirectory, file), "utf8"),
  );
  const issues = validateAdPolicy(rules, policy);
  if (issues.length > 0) {
    failed = true;
    for (const issue of issues) {
      console.error(`[ad-policy] ${file} · ${issue.ruleId} · ${issue.message}`);
    }
  }
}

if (failed) {
  console.error("Build dihentikan: aturan afiliasi melanggar kebijakan iklan.");
  process.exitCode = 1;
} else {
  console.log(`Kebijakan iklan lulus: ${ruleFiles.join(", ") || "(tidak ada aturan)"}`);
}
