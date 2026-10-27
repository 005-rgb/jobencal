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
  intent = "results",
}: {
  readonly onContinue: () => void;
  readonly intent?: "results" | "download";
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
  const isDownload = intent === "download";
  const title = isDownload ? "Unduhan siap dibuat" : "Hasil siap dihitung";

  return (
    <section
      class="price-margin-access-gate"
      aria-labelledby="result-access-gate-title"
      data-slot={isDownload ? "download-gate" : "results-gate"}
    >
      <div>
        <p class="section-kicker">SATU LANGKAH LAGI</p>
        <h2 id="result-access-gate-title">{title}</h2>
        <p>
          {isDownload
            ? "Hasil teks dibuat hanya setelah Anda melanjutkan. Isi tetap di perangkat ini."
            : "Input tetap di perangkat ini. Lanjutkan untuk menampilkan hasil satu kali."}
        </p>
      </div>
      <div
        class="price-margin-gate-ad"
        role="region"
        aria-label={isDownload ? "Slot iklan sebelum unduhan" : "Slot iklan sebelum hasil"}
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
        {isDownload ? "Lanjutkan unduhan" : "Lihat hasil"}
      </button>
    </section>
  );
}
