import { getToolBySlug } from "../data/tools.js";

export function canShowAdGate(
  adsEnabled: boolean,
  userConsented: boolean,
  providerConfigured: boolean,
): boolean {
  return adsEnabled && userConsented && providerConfigured;
}

export function getAllowedModuleDestination(
  destination: string | null,
): string | null {
  if (!destination) return null;

  let url: URL;
  try {
    url = new URL(destination, "https://jobenapp.invalid");
  } catch {
    return null;
  }

  if (
    url.origin !== "https://jobenapp.invalid" ||
    url.search ||
    url.hash ||
    !url.pathname.startsWith("/modul/")
  ) {
    return null;
  }

  const slug = url.pathname.slice("/modul/".length);
  return getToolBySlug(slug) ? `/modul/${slug}` : null;
}
