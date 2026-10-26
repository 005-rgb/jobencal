import type { AdScriptDefinition } from "./consent.js";

// Keep this empty until an approved provider and its ad-slot renderer are configured.
export const REGISTERED_AD_SCRIPTS: readonly AdScriptDefinition[] = [];

export function hasConfiguredAdProvider(): boolean {
  return REGISTERED_AD_SCRIPTS.length > 0;
}
