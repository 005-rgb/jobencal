export const CONSENT_COOKIE_NAME = "jb_consent";

const CONSENT_VERSION = 1;
const MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export interface ConsentPreferences {
  readonly necessary: true;
  readonly analytics: boolean;
  readonly ads: boolean;
}

export interface AdScriptDefinition {
  readonly id: string;
  readonly src: string;
}

export type ConsentListener = (
  preferences: ConsentPreferences | null,
) => void;

export interface MonetizationConfig {
  readonly adsEnabled: boolean;
}

const listeners = new Set<ConsentListener>();
let monetizationConfigRequest: Promise<MonetizationConfig> | null = null;
let cachedMonetizationConfig: MonetizationConfig | null = null;
const monetizationConfigListeners = new Set<
  (config: MonetizationConfig) => void
>();

export function getCachedMonetizationConfig(): MonetizationConfig | null {
  return cachedMonetizationConfig;
}

export function onMonetizationConfig(
  listener: (config: MonetizationConfig) => void,
): () => void {
  monetizationConfigListeners.add(listener);
  if (cachedMonetizationConfig) listener(cachedMonetizationConfig);
  return () => monetizationConfigListeners.delete(listener);
}

export function getMonetizationConfig(
  request: typeof fetch = fetch,
): Promise<MonetizationConfig> {
  if (!monetizationConfigRequest) {
    monetizationConfigRequest = request("/api/v1/public/monetization", {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Pengaturan monetisasi tidak tersedia.");
        const payload: unknown = await response.json();
        if (
          typeof payload !== "object" ||
          payload === null ||
          typeof (payload as Record<string, unknown>).adsEnabled !== "boolean"
        ) {
          throw new Error("Pengaturan monetisasi tidak valid.");
        }
        const config = {
          adsEnabled: (payload as { adsEnabled: boolean }).adsEnabled,
        };
        cachedMonetizationConfig = config;
        monetizationConfigListeners.forEach((listener) => listener(config));
        return config;
      })
      .catch((error: unknown) => {
        monetizationConfigRequest = null;
        console.warn("Monetisasi dinonaktifkan karena konfigurasi backend gagal dibaca.");
        throw error;
      });
  }
  return monetizationConfigRequest;
}

function isConsentPreferences(value: unknown): value is ConsentPreferences {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === CONSENT_VERSION &&
    candidate.necessary === true &&
    typeof candidate.analytics === "boolean" &&
    typeof candidate.ads === "boolean"
  );
}

export function getConsent(): ConsentPreferences | null {
  if (typeof document === "undefined") return null;
  const entry = document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${CONSENT_COOKIE_NAME}=`));
  if (!entry) return null;

  try {
    const serialized = decodeURIComponent(
      entry.slice(CONSENT_COOKIE_NAME.length + 1),
    );
    const parsed: unknown = JSON.parse(serialized);
    if (!isConsentPreferences(parsed)) return null;
    return {
      necessary: true,
      analytics: parsed.analytics,
      ads: parsed.ads,
    };
  } catch {
    return null;
  }
}

export function setConsent(
  preferences: Pick<ConsentPreferences, "analytics" | "ads">,
): ConsentPreferences {
  const saved: ConsentPreferences = {
    necessary: true,
    analytics: preferences.analytics === true,
    ads: preferences.ads === true,
  };

  if (typeof document !== "undefined") {
    const value = encodeURIComponent(
      JSON.stringify({
        version: CONSENT_VERSION,
        ...saved,
      }),
    );
    const secure =
      typeof window !== "undefined" && window.location.protocol === "https:"
        ? "; Secure"
        : "";
    document.cookie = `${CONSENT_COOKIE_NAME}=${value}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  }

  listeners.forEach((listener) => listener(saved));
  if (!saved.ads && typeof document !== "undefined") {
    document
      .querySelectorAll<HTMLScriptElement>("script[data-jobenapp-ad-script]")
      .forEach((script) => script.remove());
  }
  return saved;
}

export function onChange(listener: ConsentListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function appendAdScript(id: string, src: string): void {
  if (typeof document === "undefined") return;
  if (document.querySelector(`script[data-jobenapp-ad-script="${id}"]`)) {
    return;
  }
  const script = document.createElement("script");
  script.src = src;
  script.async = true;
  script.dataset.jobenappAdScript = id;
  document.head.append(script);
}

/**
 * Load only explicitly registered HTTPS scripts, after both policy gates pass.
 * Fase 0-M registers no providers, so the production call is intentionally empty.
 */
export function loadAdScripts(
  adsEnabled: boolean,
  preferences: ConsentPreferences | null,
  scripts: readonly AdScriptDefinition[] = [],
  appendScript: (id: string, src: string) => void = appendAdScript,
): readonly string[] {
  if (!adsEnabled || preferences?.ads !== true) return [];

  const seen = new Set<string>();
  const loaded: string[] = [];
  for (const script of scripts) {
    if (!script.id.trim() || seen.has(script.id)) continue;
    let url: URL;
    try {
      url = new URL(script.src);
    } catch {
      throw new Error(`URL skrip iklan tidak valid: ${script.id}`);
    }
    if (url.protocol !== "https:") {
      throw new Error(`Skrip iklan harus memakai HTTPS: ${script.id}`);
    }
    seen.add(script.id);
    appendScript(script.id, url.href);
    loaded.push(script.id);
  }
  return loaded;
}
