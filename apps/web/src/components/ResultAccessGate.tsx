import { useEffect, useState } from "preact/hooks";
import {
  getCachedMonetizationConfig,
  getConsent,
  getMonetizationConfig,
  onChange,
  type ConsentPreferences,
} from "../lib/consent.js";
import { canShowAdGate } from "../lib/ad-gate.js";
import { hasConfiguredAdProvider } from "../lib/ad-provider.js";

export default function ResultAccessGate({
  onContinue,
}: {
  readonly onContinue: () => void;
}) {
  const [consent, setCurrentConsent] = useState<ConsentPreferences | null>(null);
  const [adsEnabled, setAdsEnabled] = useState(
    getCachedMonetizationConfig()?.adsEnabled === true,
  );

  useEffect(() => {
    let mounted = true;
    setCurrentConsent(getConsent());
    const unsubscribe = onChange(setCurrentConsent);
    void getMonetizationConfig()
      .then((config) => {
        if (mounted) setAdsEnabled(config.adsEnabled);
      })
      .catch(() => {
        if (mounted) setAdsEnabled(false);
      });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const showAds = canShowAdGate(
    adsEnabled,
    consent?.ads === true,
    hasConfiguredAdProvider(),
  );

  return (
    <section
      class="price-margin-access-gate"
      aria-labelledby="price-margin-gate-title"
      data-slot="results-gate"
    >
      <div>
        <p class="section-kicker">SATU LANGKAH LAGI</p>
        <h2 id="price-margin-gate-title">Hasil siap dihitung</h2>
        <p>
          Input tetap di perangkat ini. Lanjutkan untuk menampilkan hasil satu kali.
        </p>
      </div>
      <div
        class="price-margin-gate-ad"
        role="region"
        aria-label="Slot iklan sebelum hasil"
      >
        <span>Iklan</span>
        <p>
          {showAds
            ? "Slot iklan yang terdaftar dapat ditampilkan di area ini."
            : "Iklan tidak ditampilkan. Anda dapat langsung melihat hasil."}
        </p>
      </div>
      <button
        class="button button-primary price-margin-gate-continue"
        type="button"
        onClick={onContinue}
      >
        Lihat hasil
      </button>
    </section>
  );
}
