import { useEffect, useRef, useState } from "preact/hooks";
import {
  calculatePriceMargin,
  type PriceMarginCalculation,
  type PriceMarginInput,
} from "@jobenapp/engine";
import { formatRupiah, parseRupiahInput } from "@jobenapp/shared";
import ResultAccessGate from "./ResultAccessGate.js";
import "../styles/price-margin-calculator.css";

type Mode = "margin" | "markup" | "analyze";

interface Draft {
  readonly mode: Mode;
  readonly baseCost: string;
  readonly target: string;
  readonly sellingPrice: string;
  readonly discount: string;
  readonly platformFee: string;
  readonly tax: string;
  readonly fixedSaleCost: string;
}

const initialDraft: Draft = {
  mode: "margin",
  baseCost: "",
  target: "30",
  sellingPrice: "",
  discount: "",
  platformFee: "",
  tax: "",
  fixedSaleCost: "",
};

function rupiah(value: bigint): string {
  return value < 0n
    ? `−Rp ${formatRupiah(-value)}`
    : `Rp ${formatRupiah(value)}`;
}

function percentage(basisPoints: bigint | null): string {
  if (basisPoints === null) return "Tidak dapat ditentukan";
  const negative = basisPoints < 0n;
  const absolute = negative ? -basisPoints : basisPoints;
  const whole = absolute / 100n;
  const fractional = (absolute % 100n).toString().padStart(2, "0");
  const decimals = fractional.endsWith("0") ? fractional[0] : fractional;
  return `${negative ? "−" : ""}${whole.toString()}${decimals === "0" ? "" : `,${decimals}`}%`;
}

function parseMoney(value: string, label: string, required = false): bigint {
  const parsed = parseRupiahInput(value);
  if (parsed === null) {
    if (required) throw new Error(`${label} wajib diisi.`);
    return 0n;
  }
  return parsed;
}

function parsePercent(
  value: string,
  label: string,
  maxBasisPoints = 10_000n,
): bigint {
  const input = value.trim();
  const match = /^(0|[1-9][0-9]{0,6})(?:,([0-9]{1,2}))?$/.exec(input);
  if (!match) {
    throw new Error(`${label} harus berupa angka persen, misalnya 25 atau 12,5.`);
  }
  const whole = BigInt(match[1]!);
  const fraction = BigInt((match[2] ?? "").padEnd(2, "0") || "0");
  const basisPoints = whole * 100n + fraction;
  if (basisPoints > maxBasisPoints) {
    throw new Error(
      maxBasisPoints === 10_000n
        ? `${label} harus berada di antara 0% dan 100%.`
        : `${label} tidak boleh melebihi 1.000.000%.`,
    );
  }
  return basisPoints;
}

function resultSummary(result: PriceMarginCalculation): string {
  const lines = [
    "JOBENAPP · Harga Jual & Margin",
    `Mode: ${result.input.mode === "analyze" ? "Cek harga jual" : result.input.mode === "margin" ? "Target margin" : "Target markup"}`,
    `Biaya dasar: ${rupiah(result.baseCostRupiah)}`,
    `Harga tertera: ${rupiah(result.listedPriceRupiah)}`,
    `Diskon: ${rupiah(result.discountRupiah)}`,
    `Omzet setelah diskon: ${rupiah(result.netSalesRupiah)}`,
    `Biaya platform: ${rupiah(result.platformFeeRupiah)}`,
    `Pajak input pengguna: ${rupiah(result.taxRupiah)}`,
    `Biaya tetap per transaksi: ${rupiah(result.fixedSaleCostRupiah)}`,
    `Laba bersih: ${rupiah(result.profitRupiah)}`,
    `Margin aktual: ${percentage(result.actualMarginBasisPoints)}`,
    `Markup aktual: ${percentage(result.actualMarkupBasisPoints)}`,
    `Metode: ${result.method.key} v${result.method.version}`,
    "Tarif dan biaya merupakan input pengguna, bukan konfirmasi aturan resmi.",
  ];
  return [...lines, ...result.warnings].join("\n");
}

function MoneyField({
  id,
  label,
  value,
  placeholder,
  hint,
  required = false,
  onInput,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly placeholder?: string;
  readonly hint?: string;
  readonly required?: boolean;
  readonly onInput: (value: string) => void;
}) {
  return (
    <label class="price-margin-field" for={id}>
      <span>{label}{required && <span aria-hidden="true"> *</span>}</span>
      <span class="price-margin-input-wrap">
        <span aria-hidden="true">Rp</span>
        <input
          id={id}
          name={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          placeholder={placeholder ?? "0"}
          required={required}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onInput={(event) => onInput(event.currentTarget.value)}
        />
      </span>
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </label>
  );
}

function PercentField({
  id,
  label,
  value,
  hint,
  onInput,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
  readonly onInput: (value: string) => void;
}) {
  return (
    <label class="price-margin-field" for={id}>
      <span>{label}</span>
      <span class="price-margin-input-wrap">
        <input
          id={id}
          name={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          placeholder="0"
          aria-describedby={hint ? `${id}-hint` : undefined}
          onInput={(event) => onInput(event.currentTarget.value)}
        />
        <span aria-hidden="true">%</span>
      </span>
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </label>
  );
}

export default function PriceMarginCalculator() {
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [result, setResult] = useState<PriceMarginCalculation | null>(null);
  const [pendingInput, setPendingInput] = useState<PriceMarginInput | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const resultContinued = useRef(false);

  function updateDraft(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setResult(null);
    setPendingInput(null);
    setError("");
    setNotice("");
  }

  useEffect(() => {
    if (!result) return;
    document.getElementById("price-margin-result")?.scrollIntoView?.({
      behavior: "smooth",
      block: "start",
    });
  }, [result]);

  useEffect(() => {
    if (!result) return;
    document.getElementById("price-margin-result")?.scrollIntoView?.({
      behavior: "smooth",
      block: "start",
    });
  }, [result]);

  function calculate(event: SubmitEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      const common = {
        baseCostRupiah: parseMoney(draft.baseCost, "Biaya dasar", true),
        discountBasisPoints: draft.discount.trim()
          ? parsePercent(draft.discount, "Diskon")
          : 0n,
        platformFeeBasisPoints: draft.platformFee.trim()
          ? parsePercent(draft.platformFee, "Biaya platform")
          : 0n,
        taxBasisPoints: draft.tax.trim()
          ? parsePercent(draft.tax, "Pajak")
          : 0n,
        fixedSaleCostRupiah: parseMoney(
          draft.fixedSaleCost,
          "Biaya tetap per transaksi",
        ),
      };
      let input: PriceMarginInput;
      if (draft.mode === "analyze") {
        input = {
          ...common,
          mode: "analyze",
          sellingPriceRupiah: parseMoney(
            draft.sellingPrice,
            "Harga jual",
            true,
          ),
        };
      } else {
        input = {
          ...common,
          mode: draft.mode,
          targetBasisPoints: parsePercent(
            draft.target,
            draft.mode === "margin" ? "Target margin" : "Target markup",
            draft.mode === "margin" ? 10_000n : 100_000_000n,
          ),
        };
      }
      resultContinued.current = false;
      setResult(null);
      setPendingInput(input);
    } catch (cause) {
      setResult(null);
      setPendingInput(null);
      setError(
        cause instanceof Error
          ? cause.message
          : "Harga jual tidak dapat dihitung dari input ini.",
      );
    }
  }

  function continueCalculation() {
    if (!pendingInput || resultContinued.current) return;
    resultContinued.current = true;
    setPendingInput(null);
    setError("");
    try {
      setResult(calculatePriceMargin(pendingInput));
    } catch (cause) {
      setResult(null);
      setError(
        cause instanceof Error
          ? cause.message
          : "Harga jual tidak dapat dihitung dari input ini.",
      );
    }
  }

  async function copyResult() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(resultSummary(result));
      setNotice("Ringkasan hasil berhasil disalin.");
    } catch {
      setNotice("Browser tidak mengizinkan penyalinan otomatis. Pilih hasil lalu salin manual.");
    }
  }

  async function shareResult() {
    if (!result) return;
    const text = resultSummary(result);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Harga Jual & Margin JOBENAPP", text });
        setNotice("Ringkasan hasil siap dibagikan.");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setNotice("Fitur bagikan tidak tersedia; ringkasan hasil disalin.");
      } else {
        setNotice("Fitur bagikan tidak tersedia pada browser ini.");
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      setNotice("Ringkasan hasil tidak dapat dibagikan dari browser ini.");
    }
  }

  return (
    <div class="price-margin-calculator">
      <div class="price-margin-local-note">
        <span aria-hidden="true">✓</span>
        <p>Hitungan berjalan di perangkat ini. Biaya dan harga yang Anda masukkan tidak dikirim ke server.</p>
      </div>

      <form class="price-margin-form" onSubmit={calculate} noValidate>
        <fieldset class="price-margin-mode">
          <legend>Bagaimana Anda ingin menentukan harga?</legend>
          <div class="price-margin-mode-options">
            <label>
              <input
                type="radio"
                name="price-mode"
                value="margin"
                checked={draft.mode === "margin"}
                onChange={() => updateDraft({ mode: "margin" })}
              />
              <span>Target margin</span>
              <small>Laba ÷ omzet setelah diskon</small>
            </label>
            <label>
              <input
                type="radio"
                name="price-mode"
                value="markup"
                checked={draft.mode === "markup"}
                onChange={() => updateDraft({ mode: "markup" })}
              />
              <span>Target markup</span>
              <small>Laba ÷ biaya dasar</small>
            </label>
            <label>
              <input
                type="radio"
                name="price-mode"
                value="analyze"
                checked={draft.mode === "analyze"}
                onChange={() => updateDraft({ mode: "analyze" })}
              />
              <span>Cek harga jual</span>
              <small>Lihat laba atau rugi harga yang ada</small>
            </label>
          </div>
        </fieldset>

        <fieldset class="price-margin-section">
          <legend>01 · Biaya dan target</legend>
          <div class="price-margin-grid">
            <MoneyField
              id="price-margin-base-cost"
              label="Biaya dasar / HPP per produk"
              value={draft.baseCost}
              placeholder="Contoh: 100.000"
              hint="Biaya dasar harus lebih besar dari nol."
              required
              onInput={(baseCost) => updateDraft({ baseCost })}
            />
            {draft.mode === "analyze" ? (
              <MoneyField
                id="price-margin-selling-price"
                label="Harga jual tertera"
                value={draft.sellingPrice}
                placeholder="Contoh: 150.000"
                required
                onInput={(sellingPrice) => updateDraft({ sellingPrice })}
              />
            ) : (
              <PercentField
                id="price-margin-target"
                label={draft.mode === "margin" ? "Target margin" : "Target markup"}
                value={draft.target}
                hint={
                  draft.mode === "margin"
                    ? "Maksimal 100%; biaya dan pajak dapat membuat target tidak mungkin."
                    : "Markup dihitung dari biaya dasar; dapat lebih dari 100%."
                }
                onInput={(target) => updateDraft({ target })}
              />
            )}
          </div>
        </fieldset>

        <details class="price-margin-options">
          <summary>Tambahkan diskon atau biaya opsional</summary>
          <p>Isi hanya biaya yang memang ingin Anda masukkan. Nilai kosong dihitung nol.</p>
          <div class="price-margin-grid">
            <PercentField
              id="price-margin-discount"
              label="Diskon pelanggan"
              value={draft.discount}
              hint="Persentase dari harga tertera."
              onInput={(discount) => updateDraft({ discount })}
            />
            <PercentField
              id="price-margin-platform-fee"
              label="Biaya platform"
              value={draft.platformFee}
              hint="Persentase dari omzet setelah diskon."
              onInput={(platformFee) => updateDraft({ platformFee })}
            />
            <PercentField
              id="price-margin-tax"
              label="Pajak input pengguna"
              value={draft.tax}
              hint="Persentase dari omzet setelah diskon; bukan hitungan pajak resmi."
              onInput={(tax) => updateDraft({ tax })}
            />
            <MoneyField
              id="price-margin-fixed-cost"
              label="Biaya tetap per transaksi"
              value={draft.fixedSaleCost}
              placeholder="Contoh: 1.000"
              hint="Biaya Rupiah tambahan setiap transaksi."
              onInput={(fixedSaleCost) => updateDraft({ fixedSaleCost })}
            />
          </div>
        </details>

        {error && <p class="price-margin-error" role="alert">{error}</p>}
        <button class="button button-primary price-margin-submit" type="submit">
          {draft.mode === "analyze" ? "Cek harga jual" : "Hitung harga jual"}
        </button>
      </form>

      {pendingInput && <ResultAccessGate onContinue={continueCalculation} />}

      {result && (
        <section
          class="price-margin-result"
          id="price-margin-result"
          aria-live="polite"
          aria-labelledby="price-margin-result-title"
        >
          <header class="price-margin-result-header">
            <div>
              <p class="section-kicker">HASIL PERHITUNGAN · METODE v{result.method.version}</p>
              <h2 id="price-margin-result-title">
                {result.input.mode === "analyze" ? "Ringkasan harga jual" : "Harga jual rekomendasi"}
              </h2>
              {result.input.mode !== "analyze" && (
                <p>
                  Target {result.input.mode === "margin" ? "margin" : "markup"}{" "}
                  {percentage(result.input.targetBasisPoints)} · harga dibulatkan ke atas.
                </p>
              )}
            </div>
            <div class="price-margin-actions" aria-label="Tindakan hasil">
              <button type="button" onClick={copyResult}>Salin</button>
              <button type="button" onClick={shareResult}>Bagikan</button>
              <button type="button" onClick={() => window.print()}>Cetak / PDF</button>
            </div>
          </header>

          {result.warnings.map((warning) => (
            <p class="price-margin-warning" role="status">{warning}</p>
          ))}

          <div class="price-margin-highlights">
            <article>
              <span>Harga tertera</span>
              <strong>{rupiah(result.listedPriceRupiah)}</strong>
              <small>Harga sebelum diskon pelanggan</small>
            </article>
            <article>
              <span>Omzet setelah diskon</span>
              <strong>{rupiah(result.netSalesRupiah)}</strong>
              <small>Dasar biaya platform dan pajak input</small>
            </article>
            <article class={result.profitRupiah < 0n ? "is-loss" : "is-profit"}>
              <span>Laba bersih</span>
              <strong>{rupiah(result.profitRupiah)}</strong>
              <small>Setelah biaya dan potongan yang dipilih</small>
            </article>
          </div>

          <div class="price-margin-ratios" aria-label="Persentase aktual">
            <p>
              <span>Margin aktual</span>
              <strong>{percentage(result.actualMarginBasisPoints)}</strong>
              <small>Laba bersih ÷ omzet setelah diskon</small>
            </p>
            <p>
              <span>Markup aktual</span>
              <strong>{percentage(result.actualMarkupBasisPoints)}</strong>
              <small>Laba bersih ÷ biaya dasar</small>
            </p>
          </div>

          <div class="price-margin-breakdown">
            <h3>Rincian perhitungan</h3>
            <dl>
              <div><dt>Biaya dasar / HPP</dt><dd>{rupiah(result.baseCostRupiah)}</dd></div>
              <div><dt>Diskon dari harga tertera</dt><dd>− {rupiah(result.discountRupiah)}</dd></div>
              <div><dt>Biaya platform dari omzet setelah diskon</dt><dd>− {rupiah(result.platformFeeRupiah)}</dd></div>
              <div><dt>Pajak input pengguna dari omzet setelah diskon</dt><dd>− {rupiah(result.taxRupiah)}</dd></div>
              <div><dt>Biaya tetap per transaksi</dt><dd>− {rupiah(result.fixedSaleCostRupiah)}</dd></div>
              <div class="price-margin-profit-line"><dt>Laba bersih</dt><dd>{rupiah(result.profitRupiah)}</dd></div>
            </dl>
          </div>

          <details class="price-margin-method">
            <summary>Asumsi, metode, dan pembulatan</summary>
            <ul>{result.assumptions.map((assumption) => <li>{assumption}</li>)}</ul>
            <p>
              Margin dan markup menggunakan definisi matematis di atas, tanpa tarif eksternal.
              Versi metode {result.method.version}. {result.method.rounding}
            </p>
          </details>
          {notice && <p class="price-margin-notice" role="status">{notice}</p>}
        </section>
      )}
    </div>
  );
}
