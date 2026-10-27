import { useState } from "preact/hooks";
import {
  calculateBreakEven,
  roundRatio,
  type BreakEvenCalculation,
} from "@jobenapp/engine";
import { formatRupiah, parseRupiahInput } from "@jobenapp/shared";
import "../styles/break-even-calculator.css";

interface Draft {
  readonly fixedCost: string;
  readonly sellingPrice: string;
  readonly variableCost: string;
}

const initialDraft: Draft = {
  fixedCost: "",
  sellingPrice: "",
  variableCost: "",
};

function rupiah(value: bigint): string {
  return value < 0n
    ? `−Rp ${formatRupiah(-value)}`
    : `Rp ${formatRupiah(value)}`;
}

function formatExactUnits(result: BreakEvenCalculation): string {
  const { numerator, denominator } = result.breakEvenUnitsExact;
  if (denominator === 1n) return `${formatRupiah(numerator)} unit`;

  const scale = 1_000_000n;
  const rounded = roundRatio(numerator * scale, denominator, "half-away-from-zero");
  const whole = rounded / scale;
  const fraction = rounded % scale;
  const decimal =
    fraction === 0n
      ? ""
      : `,${fraction.toString().padStart(6, "0").replace(/0+$/, "")}`;
  return `${formatRupiah(numerator)} / ${formatRupiah(denominator)} unit (≈ ${formatRupiah(whole)}${decimal} unit)`;
}

function shareText(result: BreakEvenCalculation): string {
  return [
    "Kalkulator BEP JOBENAPP",
    `Biaya tetap: ${rupiah(result.input.fixedCostRupiah)}`,
    `Harga jual per unit: ${rupiah(result.input.sellingPricePerUnitRupiah)}`,
    `Biaya variabel per unit: ${rupiah(result.input.variableCostPerUnitRupiah)}`,
    `Kontribusi per unit: ${rupiah(result.contributionPerUnitRupiah)}`,
    `BEP matematis: ${formatExactUnits(result)}`,
    `BEP unit utuh minimum: ${formatRupiah(result.breakEvenUnitsWhole)} unit`,
    `Penjualan pada BEP matematis: ${rupiah(result.salesAtExactBreakEvenRupiah)}`,
    `Penjualan pada unit utuh minimum: ${rupiah(result.salesAtWholeUnitThresholdRupiah)}`,
    `Metode: ${result.method.key} v${result.method.version}`,
    "Hasil memakai input dan asumsi pengguna; bukan proyeksi biaya resmi.",
  ].join("\n");
}

function MoneyField({
  id,
  label,
  value,
  hint,
  onInput,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
  readonly onInput: (value: string) => void;
}) {
  return (
    <label class="bep-field" for={id}>
      <span>{label} <span aria-hidden="true">*</span></span>
      <span class="bep-input-wrap">
        <span aria-hidden="true">Rp</span>
        <input
          id={id}
          name={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          placeholder="Contoh: 100.000"
          required
          aria-describedby={`${id}-hint`}
          onInput={(event) => onInput(event.currentTarget.value)}
        />
      </span>
      <small id={`${id}-hint`}>{hint}</small>
    </label>
  );
}

export default function BreakEvenCalculator() {
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [result, setResult] = useState<BreakEvenCalculation | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const updateDraft = (patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setResult(null);
    setError("");
    setNotice("");
  };

  const calculate = (event: SubmitEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      const readMoney = (value: string, label: string): bigint => {
        const amount = parseRupiahInput(value);
        if (amount === null) throw new Error(`${label} wajib diisi.`);
        return amount;
      };

      const calculation = calculateBreakEven({
        fixedCostRupiah: readMoney(draft.fixedCost, "Biaya tetap"),
        sellingPricePerUnitRupiah: readMoney(
          draft.sellingPrice,
          "Harga jual per unit",
        ),
        variableCostPerUnitRupiah: readMoney(
          draft.variableCost,
          "Biaya variabel per unit",
        ),
      });
      setResult(calculation);
      document.getElementById("bep-result")?.scrollIntoView?.({
        behavior: "smooth",
        block: "start",
      });
    } catch (cause) {
      setResult(null);
      setError(
        cause instanceof Error
          ? cause.message
          : "BEP tidak dapat dihitung dari input ini.",
      );
    }
  };

  const copyResult = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(shareText(result));
      setNotice("Ringkasan BEP berhasil disalin.");
    } catch {
      setNotice(
        "Browser tidak mengizinkan penyalinan otomatis. Pilih teks hasil lalu salin secara manual.",
      );
    }
  };

  const shareResult = async () => {
    if (!result) return;
    const text = shareText(result);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Kalkulator BEP JOBENAPP", text });
        setNotice("Ringkasan BEP siap dibagikan.");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setNotice("Fitur bagikan tidak tersedia; ringkasan BEP disalin.");
      } else {
        setNotice("Fitur bagikan tidak tersedia pada browser ini.");
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      setNotice("Ringkasan BEP tidak dapat dibagikan dari browser ini.");
    }
  };

  return (
    <div class="bep-calculator">
      <div class="bep-local-note">
        <span aria-hidden="true">✓</span>
        <p>
          Perhitungan dilakukan di perangkat ini. Input biaya dan harga tidak
          dikirim ke server.
        </p>
      </div>

      <form class="bep-form" onSubmit={calculate} noValidate>
        <fieldset class="bep-section">
          <legend>Biaya dan harga per unit</legend>
          <div class="bep-grid">
            <MoneyField
              id="bep-fixed-cost"
              label="Biaya tetap untuk periode ini"
              value={draft.fixedCost}
              hint="Contoh: sewa atau biaya tetap lain pada periode penjualan yang sama."
              onInput={(fixedCost) => updateDraft({ fixedCost })}
            />
            <MoneyField
              id="bep-selling-price"
              label="Harga jual per unit"
              value={draft.sellingPrice}
              hint="Harga jual satu unit sebelum biaya."
              onInput={(sellingPrice) => updateDraft({ sellingPrice })}
            />
            <MoneyField
              id="bep-variable-cost"
              label="Biaya variabel per unit"
              value={draft.variableCost}
              hint="Total biaya yang berubah mengikuti jumlah unit, untuk satu unit."
              onInput={(variableCost) => updateDraft({ variableCost })}
            />
          </div>
        </fieldset>

        {error && <p class="bep-error" role="alert">{error}</p>}
        <button class="button button-primary bep-submit" type="submit">
          Hitung titik impas
        </button>
      </form>

      {result && (
        <section
          class="bep-result"
          id="bep-result"
          aria-live="polite"
          aria-labelledby="bep-result-title"
        >
          <header class="bep-result-header">
            <div>
              <p class="section-kicker">
                HASIL PERHITUNGAN · METODE v{result.method.version}
              </p>
              <h2 id="bep-result-title">Titik impas usaha Anda</h2>
              <p>
                {result.input.fixedCostRupiah === 0n
                  ? "Biaya tetap nol; titik impas tercapai pada nol unit."
                  : "Angka unit menampilkan rasio matematis dan jumlah unit utuh minimum."}
              </p>
            </div>
            <div class="bep-actions" aria-label="Tindakan hasil">
              <button type="button" onClick={copyResult}>Salin</button>
              <button type="button" onClick={shareResult}>Bagikan</button>
              <button type="button" onClick={() => window.print()}>
                Cetak / PDF
              </button>
            </div>
          </header>

          {result.warnings.map((warning) => (
            <p class="bep-warning" role="status">{warning}</p>
          ))}

          <div class="bep-highlights">
            <article>
              <span>BEP matematis</span>
              <strong>{formatExactUnits(result)}</strong>
              <small>Biaya tetap ÷ kontribusi per unit</small>
            </article>
            <article class="bep-whole-units">
              <span>Minimum unit utuh</span>
              <strong>
                {formatRupiah(result.breakEvenUnitsWhole)} unit
              </strong>
              <small>Dibulatkan ke atas; produk dijual per unit</small>
            </article>
            <article>
              <span>Penjualan saat BEP matematis</span>
              <strong>{rupiah(result.salesAtExactBreakEvenRupiah)}</strong>
              <small>Dibulatkan ke Rupiah utuh</small>
            </article>
          </div>

          <div class="bep-breakdown">
            <h3>Rincian perhitungan</h3>
            <dl>
              <div>
                <dt>Biaya tetap</dt>
                <dd>{rupiah(result.input.fixedCostRupiah)}</dd>
              </div>
              <div>
                <dt>Harga jual per unit</dt>
                <dd>{rupiah(result.input.sellingPricePerUnitRupiah)}</dd>
              </div>
              <div>
                <dt>Biaya variabel per unit</dt>
                <dd>{rupiah(result.input.variableCostPerUnitRupiah)}</dd>
              </div>
              <div class="bep-contribution-line">
                <dt>Kontribusi per unit</dt>
                <dd>{rupiah(result.contributionPerUnitRupiah)}</dd>
              </div>
              <div>
                <dt>Penjualan pada unit utuh minimum</dt>
                <dd>{rupiah(result.salesAtWholeUnitThresholdRupiah)}</dd>
              </div>
            </dl>
          </div>

          <div class="bep-profit-check">
            <h3>Periksa laba/rugi di sekitar BEP</h3>
            <p>
              Satu unit sebelum ambang:{" "}
              {result.profitOneUnitBeforeRupiah === null
                ? "tidak berlaku karena unit tidak dapat bernilai negatif."
                : rupiah(result.profitOneUnitBeforeRupiah)}
            </p>
            <p>
              Pada jumlah unit utuh minimum:{" "}
              {rupiah(result.profitAtWholeUnitThresholdRupiah)}
            </p>
            <p>
              Satu unit setelah ambang:{" "}
              {rupiah(result.profitOneUnitAfterRupiah)}
            </p>
          </div>

          <details class="bep-method">
            <summary>Asumsi, metode, dan pembulatan</summary>
            <ul>
              {result.assumptions.map((assumption) => <li>{assumption}</li>)}
            </ul>
            <p>{result.method.rounding}</p>
            <p>
              Rumus matematis, tanpa tarif eksternal. Hasil bergantung pada
              kesesuaian asumsi biaya dan harga yang Anda masukkan.
            </p>
          </details>
          {notice && <p class="bep-notice" role="status">{notice}</p>}
        </section>
      )}
    </div>
  );
}
