import { useEffect, useState } from "preact/hooks";
import {
  getConsent,
  loadAdScripts,
  onChange,
  setConsent,
  type ConsentPreferences,
} from "../lib/consent.js";

const ADS_ENABLED = import.meta.env.ADS_ENABLED === "true";
const REGISTERED_AD_SCRIPTS = [] as const;

function enablePermittedAds(preferences: ConsentPreferences) {
  loadAdScripts(ADS_ENABLED, preferences, REGISTERED_AD_SCRIPTS);
}

export default function ConsentManager() {
  const [consent, setCurrentConsent] = useState<ConsentPreferences | null>(null);
  const [showPreferences, setShowPreferences] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [ads, setAds] = useState(false);

  useEffect(() => {
    const current = getConsent();
    setCurrentConsent(current);
    setAnalytics(current?.analytics ?? false);
    setAds(current?.ads ?? false);
    return onChange((updated) => {
      setCurrentConsent(updated);
      setAnalytics(updated?.analytics ?? false);
      setAds(updated?.ads ?? false);
    });
  }, []);

  function savePreferences(analyticsChoice: boolean, adsChoice: boolean) {
    const saved = setConsent({
      analytics: analyticsChoice,
      ads: adsChoice,
    });
    enablePermittedAds(saved);
    setShowPreferences(false);
  }

  const bannerVisible = consent === null || showPreferences;

  return (
    <>
      <button
        class="consent-settings-link"
        type="button"
        onClick={() => setShowPreferences(true)}
      >
        Pengaturan cookie
      </button>
      {bannerVisible && (
        <section
          class="consent-banner"
          role="region"
          aria-labelledby="consent-heading"
          data-testid="consent-banner"
        >
          <div class="consent-banner-copy">
            <p class="consent-eyebrow">PRIVASI ANDA</p>
            <h2 id="consent-heading">Pilih penggunaan cookie</h2>
            <p>
              Cookie yang diperlukan selalu aktif. Analitik dan iklan hanya
              digunakan setelah Anda menyetujuinya. Pilihan tersimpan di
              perangkat ini.
            </p>
          </div>
          <div class="consent-banner-controls">
            <div class="consent-decisions">
              <button
                class="consent-decision"
                type="button"
                onClick={() => savePreferences(false, false)}
              >
                Tolak opsional
              </button>
              <button
                class="consent-decision"
                type="button"
                onClick={() => savePreferences(true, true)}
              >
                Terima semua
              </button>
              <button
                class="consent-preferences-toggle"
                type="button"
                aria-expanded={showPreferences}
                onClick={() => setShowPreferences((visible) => !visible)}
              >
                Atur pilihan
              </button>
            </div>
            {showPreferences && (
              <div class="consent-preferences" aria-label="Pengaturan cookie">
                <p>
                  <strong>Wajib aktif</strong>
                  <span>Cookie yang diperlukan untuk fungsi dasar.</span>
                </p>
                <label>
                  <input
                    type="checkbox"
                    checked={analytics}
                    onChange={(event) =>
                      setAnalytics(
                        (event.currentTarget as HTMLInputElement).checked,
                      )
                    }
                  />
                  <span>
                    <strong>Analitik</strong>
                    <small>Pengukuran penggunaan situs.</small>
                  </span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={ads}
                    onChange={(event) =>
                      setAds((event.currentTarget as HTMLInputElement).checked)
                    }
                  />
                  <span>
                    <strong>Iklan</strong>
                    <small>Konten iklan atau afiliasi yang relevan.</small>
                  </span>
                </label>
                <button
                  class="consent-save"
                  type="button"
                  onClick={() => savePreferences(analytics, ads)}
                >
                  Simpan pilihan
                </button>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
