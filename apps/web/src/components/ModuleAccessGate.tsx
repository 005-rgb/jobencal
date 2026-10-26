import { useEffect, useState } from "preact/hooks";
import { getToolBySlug } from "../data/tools.js";
import {
  getConsent,
  getMonetizationConfig,
  onChange,
  type ConsentPreferences,
} from "../lib/consent.js";
import {
  canShowAdGate,
  getAllowedModuleDestination,
} from "../lib/ad-gate.js";
import { hasConfiguredAdProvider } from "../lib/ad-provider.js";

type GateState = "checking" | "ready" | "unavailable";

export default function ModuleAccessGate() {
  const [destination, setDestination] = useState<string | null>(null);
  const [consent, setConsent] = useState<ConsentPreferences | null>(null);
  const [adsEnabled, setAdsEnabled] = useState(false);
  const [gateState, setGateState] = useState<GateState>("checking");

  useEffect(() => {
    const target = getAllowedModuleDestination(
      new URL(window.location.href).searchParams.get("tujuan"),
    );
    setDestination(target);
    setConsent(getConsent());

    if (!target) {
      setGateState("unavailable");
      return;
    }

    const unsubscribe = onChange((updated) => setConsent(updated));
    void getMonetizationConfig()
      .then((config) => {
        setAdsEnabled(config.adsEnabled);
        setGateState("ready");
      })
      .catch(() => {
        setAdsEnabled(false);
        setGateState("ready");
      });

    return unsubscribe;
  }, []);

  const tool = destination
    ? getToolBySlug(destination.slice("/modul/".length))
    : undefined;
  const showAds = canShowAdGate(
    adsEnabled,
    consent?.ads === true,
    hasConfiguredAdProvider(),
  );

  function continueToModule() {
    if (destination) window.location.assign(destination);
  }

  return (
    <main class="access-gate-page">
      <a class="access-back-link" href="/">
        ← Kembali ke daftar modul
      </a>
      <section class="access-gate-card" aria-labelledby="access-gate-title">
        <p class="section-kicker">AKSES MODUL</p>
        <h1 id="access-gate-title">
          {tool ? `Sebelum membuka ${tool.name}` : "Modul tidak ditemukan"}
        </h1>
        <p class="access-gate-description">
          {tool
            ? "Kami menyiapkan ruang iklan sebelum modul. Anda tetap dapat melanjutkan tanpa menunggu atau menyetujui iklan."
            : "Tautan modul ini tidak valid. Kembali ke katalog untuk memilih modul yang tersedia."}
        </p>

        <div
          class="access-ad-area"
          data-slot="module-entry-gate"
          role="region"
          aria-label="Slot iklan sebelum akses modul"
        >
          <span class="access-ad-label">Iklan</span>
          <div class="access-ad-placeholder" aria-live="polite">
            {gateState === "checking"
              ? "Memeriksa ketersediaan iklan…"
              : showAds
                ? "Iklan terdaftar dapat ditampilkan di area ini."
                : "Iklan tidak ditampilkan. Anda dapat melanjutkan."}
          </div>
        </div>

        <p class="access-privacy-note">
          Input, hasil hitung, dan berkas Anda tidak dibagikan kepada penyedia
          iklan. Pilihan cookie iklan dapat diubah kapan saja.
        </p>
        {tool && (
          <button
            class="button button-primary access-continue"
            type="button"
            disabled={gateState === "checking"}
            onClick={continueToModule}
          >
            Lanjut ke {tool.name} <span aria-hidden="true">→</span>
          </button>
        )}
        {!tool && (
          <a class="button button-secondary access-continue" href="/">
            Buka katalog modul
          </a>
        )}
      </section>
    </main>
  );
}
