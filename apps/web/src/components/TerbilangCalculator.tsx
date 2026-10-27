import { useRef, useState } from "preact/hooks";
import {
  calculateTerbilang,
  type TerbilangCalculation,
  type TerbilangFormat,
} from "@jobenapp/engine";
import ResultAccessGate from "./ResultAccessGate.js";
import "../styles/terbilang-calculator.css";

interface Draft {
  readonly value: string;
  readonly format: TerbilangFormat;
}

const initialDraft: Draft = { value: "", format: "angka" };

function resultSummary(result: TerbilangCalculation): string {
  return [
    "JOBENAPP · Terbilang",
    `Angka: ${result.input.normalizedValue}`,
    `Format: ${result.input.format === "rupiah" ? "Nominal Rupiah" : "Angka"}`,
    `Hasil: ${result.text}`,
    `Metode: ${result.method.key} v${result.method.version}`,
    "Konversi berjalan di perangkat; tidak ada pembulatan.",
  ].join("\n");
}

export default function TerbilangCalculator() {
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [pendingResult, setPendingResult] =
    useState<TerbilangCalculation | null>(null);
  const [result, setResult] = useState<TerbilangCalculation | null>(null);
  const [downloadPending, setDownloadPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const resultContinued = useRef(false);
  const downloadContinued = useRef(false);

  function updateDraft(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setPendingResult(null);
    setResult(null);
    setDownloadPending(false);
    setError("");
    setNotice("");
    resultContinued.current = false;
    downloadContinued.current = false;
  }

  function calculate(event: SubmitEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    setResult(null);
    setDownloadPending(false);
    resultContinued.current = false;
    downloadContinued.current = false;

    try {
      setPendingResult(
        calculateTerbilang({
          value: draft.value,
          format: draft.format,
        }),
      );
    } catch (cause) {
      setPendingResult(null);
      setError(
        cause instanceof Error
          ? cause.message
          : "Angka tidak dapat diubah menjadi terbilang.",
      );
    }
  }

  function continueCalculation() {
    if (!pendingResult || resultContinued.current) return;
    resultContinued.current = true;
    setResult(pendingResult);
    setPendingResult(null);
  }

  async function copyResult() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(resultSummary(result));
      setNotice("Ringkasan terbilang berhasil disalin.");
    } catch {
      setNotice(
        "Browser tidak mengizinkan penyalinan otomatis. Pilih hasil lalu salin secara manual.",
      );
    }
  }

  async function shareResult() {
    if (!result) return;
    const text = resultSummary(result);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Terbilang JOBENAPP", text });
        setNotice("Ringkasan terbilang siap dibagikan.");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setNotice("Fitur bagikan tidak tersedia; ringkasan hasil disalin.");
      } else {
        setNotice("Fitur bagikan tidak tersedia pada browser ini.");
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      setNotice("Ringkasan terbilang tidak dapat dibagikan dari browser ini.");
    }
  }

  function prepareDownload() {
    if (!result) return;
    downloadContinued.current = false;
    setDownloadPending(true);
  }

  function downloadResult() {
    if (!result || downloadContinued.current) return;
    downloadContinued.current = true;
    setDownloadPending(false);

    const blob = new Blob([`${resultSummary(result)}\n`], {
      type: "text/plain;charset=utf-8",
    });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const filenameValue = result.input.normalizedValue.replace(/[^0-9-]/g, "");
    link.href = objectUrl;
    link.download = `terbilang-${filenameValue || "hasil"}.txt`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    setNotice("Berkas teks terbilang telah disiapkan.");
  }

  return (
    <div class="terbilang-calculator">
      <div class="terbilang-local-note">
        <span aria-hidden="true">✓</span>
        <p>
          Konversi berjalan di perangkat ini. Angka yang Anda masukkan tidak
          dikirim ke server.
        </p>
      </div>

      <form class="terbilang-form" onSubmit={calculate} noValidate>
        <fieldset class="terbilang-section">
          <legend>01 · Masukkan angka</legend>
          <label class="terbilang-field" for="terbilang-value">
            <span>Angka yang akan diubah</span>
            <input
              id="terbilang-value"
              name="value"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellcheck={false}
              value={draft.value}
              placeholder="Contoh: -1.234.567,80"
              aria-describedby="terbilang-value-hint"
              onInput={(event) =>
                updateDraft({ value: event.currentTarget.value })
              }
            />
            <small id="terbilang-value-hint">
              Gunakan titik untuk kelompok ribuan dan koma untuk desimal.
              Maksimal 18 digit bulat dan 18 digit desimal.
            </small>
          </label>
        </fieldset>

        <fieldset class="terbilang-section">
          <legend>02 · Pilih bentuk hasil</legend>
          <div class="terbilang-format-options">
            <label>
              <input
                type="radio"
                name="terbilang-format"
                value="angka"
                checked={draft.format === "angka"}
                onChange={() => updateDraft({ format: "angka" })}
              />
              <span>
                <strong>Angka</strong>
                <small>Contoh: satu juta dua ratus</small>
              </span>
            </label>
            <label>
              <input
                type="radio"
                name="terbilang-format"
                value="rupiah"
                checked={draft.format === "rupiah"}
                onChange={() => updateDraft({ format: "rupiah" })}
              />
              <span>
                <strong>Nominal Rupiah</strong>
                <small>Tambahkan kata “rupiah” pada bilangan bulat</small>
              </span>
            </label>
          </div>
        </fieldset>

        {error && <p class="terbilang-error" role="alert">{error}</p>}
        <button class="button button-primary terbilang-submit" type="submit">
          Ubah menjadi terbilang
        </button>
      </form>

      {pendingResult && (
        <ResultAccessGate onContinue={continueCalculation} />
      )}

      {result && (
        <section
          class="terbilang-result"
          id="terbilang-result"
          aria-live="polite"
          aria-labelledby="terbilang-result-title"
        >
          <header class="terbilang-result-header">
            <div>
              <p class="section-kicker">
                HASIL KONVERSI · METODE v{result.method.version}
              </p>
              <h2 id="terbilang-result-title">Hasil terbilang</h2>
              <p>
                {result.input.format === "rupiah"
                  ? "Format nominal Rupiah"
                  : "Format angka"}
                {" · "}
                <span class="terbilang-input-value">
                  {result.input.normalizedValue}
                </span>
              </p>
            </div>
            <div class="terbilang-actions no-print" aria-label="Tindakan hasil">
              <button type="button" onClick={copyResult}>Salin</button>
              <button type="button" onClick={shareResult}>Bagikan</button>
              <button type="button" onClick={() => window.print()}>
                Cetak / PDF
              </button>
              <button type="button" onClick={prepareDownload}>
                Unduh .txt
              </button>
            </div>
          </header>

          <div class="terbilang-word-output">
            <span>Terbilang</span>
            <p>{result.text}</p>
          </div>

          {error && <p class="terbilang-error" role="alert">{error}</p>}
          {notice && <p class="terbilang-notice" role="status">{notice}</p>}

          {downloadPending && (
            <ResultAccessGate
              intent="download"
              onContinue={downloadResult}
            />
          )}

          <div class="terbilang-breakdown">
            <h3>Aturan pembacaan</h3>
            <dl>
              {result.steps.map((step) => (
                <div key={step.key}>
                  <dt>{step.label}</dt>
                  <dd>{step.result}</dd>
                </div>
              ))}
            </dl>
          </div>

          <details class="terbilang-method">
            <summary>Metode, batas, dan rujukan bahasa</summary>
            <ul>
              {result.assumptions.map((assumption) => (
                <li key={assumption}>{assumption}</li>
              ))}
            </ul>
            <p>{result.rounding.description}</p>
            <p>
              Standar numeralia: {result.provenance.standard} Pemeriksaan
              sumber: {result.provenance.checkedOn}. Tinjauan bahasa independen
              masih diperlukan sebelum gerbang fase dinyatakan lulus.
            </p>
            <ul>
              {result.provenance.sources.map((source) => (
                <li key={source}>
                  <a href={source} target="_blank" rel="noreferrer">
                    {source}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}
    </div>
  );
}
