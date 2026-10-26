import { useState } from "preact/hooks";
import type { TargetedSubmitEvent } from "preact";
import {
  calculatePercentage,
  serializeCalculationResult,
  type CalculationResult,
  type RoundingMode,
} from "@jobenapp/engine";
import {
  formatPercentage,
  formatRupiah,
  parsePercentageInput,
  parseRupiahInput,
} from "@jobenapp/shared";
import AffiliateSlot from "./AffiliateSlot.js";

const METHOD_VERSION = "core-percentage/1.0.0";

function readableError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Perhitungan tidak dapat diproses. Periksa kembali input.";
}

export default function CoreSystemPlayground() {
  const [amountText, setAmountText] = useState("1.500.000");
  const [rateText, setRateText] = useState("2,5");
  const [rounding, setRounding] = useState<RoundingMode>(
    "half-away-from-zero",
  );
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function handleSubmit(event: TargetedSubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      const amount = parseRupiahInput(amountText);
      const rate = parsePercentageInput(rateText);
      if (amount === null) {
        throw new Error("Nominal Rupiah wajib diisi.");
      }
      if (rate === null) {
        throw new Error("Persentase wajib diisi.");
      }
      setResult(
        calculatePercentage({
          amountRupiah: amount,
          rateBasisPoints: rate,
          rounding,
          methodVersion: METHOD_VERSION,
        }),
      );
    } catch (calculationError) {
      setResult(null);
      setError(readableError(calculationError));
    }
  }

  async function copyResult() {
    if (!result) return;
    const summary = [
      "JOBENAPP · Demo mesin hitung Fase 1.0",
      `Nominal: Rp ${formatRupiah(result.input.amountRupiah)}`,
      `Persentase input: ${formatPercentage(result.input.rateBasisPoints)}%`,
      `Hasil: Rp ${formatRupiah(result.resultRupiah)}`,
      `Metode: ${result.method.key} v${result.method.version}`,
      `Pembulatan: ${result.rounding.description}`,
      "Catatan: demo matematis; bukan tarif pajak, bank, atau marketplace.",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(summary);
      setNotice("Ringkasan berhasil disalin.");
    } catch {
      setNotice("Clipboard tidak tersedia. Pilih dan salin hasil secara manual.");
    }
  }

  return (
    <div class="core-playground">
      <div class="core-playground-intro">
        <span class="core-live-badge">
          <i aria-hidden="true" />
          Mesin lokal aktif
        </span>
        <h3>Uji hitungan persentase</h3>
        <p>
          Masukkan nominal dan persentase sendiri. Hasil dihitung di browser
          dengan integer Rupiah, tanpa mengirim nilai ke server.
        </p>
        <ul class="core-benefits">
          <li>
            <span aria-hidden="true">01</span>
            Angka tidak melewati floating point
          </li>
          <li>
            <span aria-hidden="true">02</span>
            Metode pembulatan dapat dipilih
          </li>
          <li>
            <span aria-hidden="true">03</span>
            Input tetap di perangkat Anda
          </li>
        </ul>
      </div>

      <div class="core-calculator">
        <form class="core-form" onSubmit={handleSubmit}>
          <label class="core-field" for="core-amount">
            <span>Nominal dasar</span>
            <span class="core-input-wrap">
              <span aria-hidden="true">Rp</span>
              <input
                id="core-amount"
                name="amount"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                required
                value={amountText}
                aria-describedby="core-amount-hint"
                onInput={(event) =>
                  setAmountText((event.currentTarget as HTMLInputElement).value)
                }
              />
            </span>
            <small id="core-amount-hint">
              Rupiah utuh · contoh 1500000 atau 1.500.000
            </small>
          </label>

          <label class="core-field" for="core-rate">
            <span>Persentase input</span>
            <span class="core-input-wrap core-rate-wrap">
              <input
                id="core-rate"
                name="rate"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                required
                value={rateText}
                aria-describedby="core-rate-hint"
                onInput={(event) =>
                  setRateText((event.currentTarget as HTMLInputElement).value)
                }
              />
              <span aria-hidden="true">%</span>
            </span>
            <small id="core-rate-hint">0–100% · maksimal 2 angka desimal</small>
          </label>

          <label class="core-field core-rounding-field" for="core-rounding">
            <span>Aturan pembulatan hasil</span>
            <select
              id="core-rounding"
              name="rounding"
              value={rounding}
              onChange={(event) =>
                setRounding(
                  (event.currentTarget as HTMLSelectElement)
                    .value as RoundingMode,
                )
              }
            >
              <option value="half-away-from-zero">
                Terdekat · setengah menjauhi nol
              </option>
              <option value="floor">Ke bawah</option>
              <option value="ceiling">Ke atas</option>
            </select>
          </label>

          <button class="core-submit" type="submit">
            Hitung hasil <span aria-hidden="true">→</span>
          </button>
        </form>

        <div class="core-result" aria-live="polite" aria-atomic="true">
          {error ? (
            <div class="core-error" role="alert">
              <strong>Input belum dapat dihitung</strong>
              <p>{error}</p>
            </div>
          ) : result ? (
            <>
              <div class="core-result-topline">
                <span>HASIL TERHITUNG</span>
                <span class="core-result-version">
                  {result.method.version}
                </span>
              </div>
              <p class="core-result-label">Nilai persentase</p>
              <strong class="core-result-value">
                Rp {formatRupiah(result.resultRupiah)}
              </strong>
              <ol class="core-steps">
                {result.steps.map((step, index) => (
                  <li key={step.key}>
                    <span class="core-step-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <strong>{step.label}</strong>
                      <small>
                        {index === 0
                          ? `Rp ${formatRupiah(step.resultRupiah)}`
                          : `${formatRupiah(result.input.amountRupiah)} × ${result.input.rateBasisPoints.toString()} / 10.000`}
                      </small>
                    </div>
                    <b>Rp {formatRupiah(step.resultRupiah)}</b>
                  </li>
                ))}
              </ol>
              <p class="core-rounding-note">
                {result.rounding.description} Pembulatan diterapkan pada hasil
                akhir.
              </p>
              <div class="core-result-actions">
                <button type="button" onClick={copyResult}>
                  Salin ringkasan
                </button>
              </div>
              {notice && <p class="core-notice" role="status">{notice}</p>}
            </>
          ) : (
            <div class="core-result-empty">
              <span class="core-result-icon" aria-hidden="true">
                1/10.000
              </span>
              <strong>Hasil Anda akan muncul di sini</strong>
              <p>
                Setiap langkah dan metode pembulatan ditampilkan setelah
                dihitung.
              </p>
            </div>
          )}
        </div>
        {result && (
          <AffiliateSlot
            toolKey="percentage-demo"
            resultRupiah={result.resultRupiah}
          />
        )}
      </div>

      <p class="core-disclaimer">
        <strong>Demo metode, bukan kalkulator tarif resmi.</strong> Persentase
        berasal dari input Anda. Tidak ada tarif pajak, iuran, biaya bank, atau
        marketplace yang diasumsikan.
      </p>
      {result && (
        <details class="core-replay">
          <summary>Lihat data reproduksi</summary>
          <pre>{serializeCalculationResult(result)}</pre>
        </details>
      )}
    </div>
  );
}
