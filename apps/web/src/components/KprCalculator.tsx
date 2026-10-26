import { useState } from "preact/hooks";
import { calculateKpr, type KprCalculation, type KprModel } from "@jobenapp/engine";
import {
  formatPercentage,
  formatRupiah,
  parsePercentageInput,
  parseRupiahInput,
} from "@jobenapp/shared";
import "../styles/kpr-calculator.css";

interface KprDraft {
  principal: string;
  termMonths: string;
  model: KprModel;
  annualRate: string;
  hasFloatingRate: boolean;
  fixedMonths: string;
  floatingRate: string;
  earlyMonth: string;
  earlyAmount: string;
  provision: string;
  administration: string;
  insurance: string;
  taxAndNotary: string;
  quoteProduct: string;
  quoteDate: string;
  quoteValidUntil: string;
}

const initialDraft: KprDraft = {
  principal: "",
  termMonths: "",
  model: "annuity",
  annualRate: "",
  hasFloatingRate: false,
  fixedMonths: "",
  floatingRate: "",
  earlyMonth: "",
  earlyAmount: "",
  provision: "",
  administration: "",
  insurance: "",
  taxAndNotary: "",
  quoteProduct: "",
  quoteDate: "",
  quoteValidUntil: "",
};

const modelLabels: Readonly<Record<KprModel, string>> = {
  annuity: "Anuitas",
  flat: "Flat",
  effective: "Efektif",
};

function rupiah(value: bigint): string {
  return `Rp ${formatRupiah(value)}`;
}

function parseRequiredRupiah(value: string, label: string): bigint {
  const parsed = parseRupiahInput(value);
  if (parsed === null) throw new Error(`${label} wajib diisi.`);
  return parsed;
}

function parseOptionalRupiah(value: string, label: string): bigint | undefined {
  if (!value.trim()) return undefined;
  return parseRequiredRupiah(value, label);
}

function parseRequiredRate(value: string, label: string): bigint {
  const parsed = parsePercentageInput(value);
  if (parsed === null) throw new Error(`${label} wajib diisi.`);
  return parsed;
}

function NumberField({
  id,
  label,
  value,
  placeholder,
  hint,
  onInput,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly placeholder?: string;
  readonly hint?: string;
  readonly onInput: (value: string) => void;
}) {
  return (
    <label class="kpr-field" for={id}>
      <span>{label}</span>
      <input
        id={id}
        name={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onInput={(event) => onInput(event.currentTarget.value)}
      />
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </label>
  );
}

function RateField({
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
    <label class="kpr-field" for={id}>
      <span>{label}</span>
      <span class="kpr-rate-control">
        <input
          id={id}
          name={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          placeholder="Contoh: 6,5"
          aria-describedby={hint ? `${id}-hint` : undefined}
          onInput={(event) => onInput(event.currentTarget.value)}
        />
        <span aria-hidden="true">% / tahun</span>
      </span>
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </label>
  );
}

function costLabel(key: keyof KprCalculation["costs"]): string {
  const labels: Record<keyof KprCalculation["costs"], string> = {
    provisionRupiah: "Provisi",
    administrationRupiah: "Administrasi",
    insuranceRupiah: "Asuransi",
    taxAndNotaryRupiah: "Pajak & notaris",
  };
  return labels[key];
}

function buildShareText(result: KprCalculation): string {
  return [
    "Simulasi KPR JOBENAPP",
    `Model: ${modelLabels[result.method.model]}`,
    `Pokok: ${rupiah(result.totals.principalRupiah)}`,
    `Bunga: ${rupiah(result.totals.interestRupiah)}`,
    `Total biaya terpisah: ${rupiah(result.totals.feesRupiah)}`,
    `Total pengeluaran simulasi: ${rupiah(result.totals.totalCashOutflowRupiah)}`,
    "Hasil adalah simulasi berdasarkan asumsi pengguna, bukan penawaran bank.",
  ].join("\n");
}

export default function KprCalculator() {
  const [draft, setDraft] = useState<KprDraft>(initialDraft);
  const [result, setResult] = useState<KprCalculation | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const updateDraft = (patch: Partial<KprDraft>) => {
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
      const principalRupiah = parseRequiredRupiah(draft.principal, "Pokok pinjaman");
      const annualRateBasisPoints = parseRequiredRate(draft.annualRate, "Suku bunga");
      const termMonths = Number(draft.termMonths);
      if (!/^[0-9]+$/.test(draft.termMonths)) {
        throw new Error("Tenor harus diisi dalam bilangan bulat bulan.");
      }
      const hasAnyQuoteMetadata = Boolean(
        draft.quoteProduct.trim() || draft.quoteDate || draft.quoteValidUntil,
      );
      const hasCompleteQuoteMetadata = Boolean(
        draft.quoteProduct.trim() && draft.quoteDate && draft.quoteValidUntil,
      );
      if (hasAnyQuoteMetadata && !hasCompleteQuoteMetadata) {
        throw new Error(
          "Lengkapi nama produk bank, tanggal kutipan, dan tanggal akhir berlaku; atau kosongkan seluruh data kutipan.",
        );
      }
      if (
        draft.quoteDate &&
        draft.quoteValidUntil &&
        draft.quoteValidUntil < draft.quoteDate
      ) {
        throw new Error("Tanggal akhir berlaku kutipan tidak boleh lebih awal dari tanggal kutipan.");
      }
      if (Boolean(draft.earlyMonth.trim()) !== Boolean(draft.earlyAmount.trim())) {
        throw new Error(
          "Isi bulan dan nominal pelunasan dipercepat bersama-sama, atau kosongkan keduanya.",
        );
      }

      const resultInput = {
        principalRupiah,
        annualRateBasisPoints,
        termMonths,
        model: draft.model,
        floatingRate: draft.hasFloatingRate
          ? {
              fixedMonths: Number(draft.fixedMonths),
              annualRateBasisPoints: parseRequiredRate(
                draft.floatingRate,
                "Suku bunga mengambang",
              ),
            }
          : undefined,
        earlyRepayment: draft.earlyAmount.trim()
          ? {
              month: Number(draft.earlyMonth),
              amountRupiah: parseRequiredRupiah(
                draft.earlyAmount,
                "Pelunasan dipercepat",
              ),
            }
          : undefined,
        costs: {
          provisionRupiah: parseOptionalRupiah(draft.provision, "Provisi"),
          administrationRupiah: parseOptionalRupiah(
            draft.administration,
            "Administrasi",
          ),
          insuranceRupiah: parseOptionalRupiah(draft.insurance, "Asuransi"),
          taxAndNotaryRupiah: parseOptionalRupiah(
            draft.taxAndNotary,
            "Pajak dan notaris",
          ),
        },
      } as const;
      const calculation = calculateKpr(resultInput);
      setResult(calculation);
      const destination = document.getElementById("kpr-result");
      destination?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (caught) {
      setResult(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "Perhitungan tidak dapat dilakukan. Periksa kembali input Anda.",
      );
    }
  };

  const copyResult = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(buildShareText(result));
      setNotice("Ringkasan simulasi disalin.");
    } catch {
      setNotice("Browser tidak mengizinkan penyalinan. Gunakan tombol cetak atau bagikan.");
    }
  };

  const shareUrl = result
    ? `https://wa.me/?text=${encodeURIComponent(buildShareText(result))}`
    : undefined;

  return (
    <div class="kpr-calculator">
      <aside class="kpr-local-notice">
        <span aria-hidden="true">i</span>
        <p>
          Perhitungan berjalan di perangkat ini. Suku bunga dan biaya adalah
          input Anda, bukan data tarif bank. Hasil merupakan simulasi, bukan
          penawaran atau persetujuan kredit.
        </p>
      </aside>

      <form class="kpr-form" onSubmit={calculate}>
        <fieldset class="kpr-section">
          <legend>Pinjaman & metode</legend>
          <div class="kpr-grid">
            <NumberField
              id="kpr-principal"
              label="Pokok pinjaman"
              value={draft.principal}
              placeholder="Contoh: 500.000.000"
              hint="Masukkan angka Rupiah utuh."
              onInput={(principal) => updateDraft({ principal })}
            />
            <NumberField
              id="kpr-term"
              label="Tenor"
              value={draft.termMonths}
              placeholder="Contoh: 180"
              hint="Dalam bulan, maksimal 360 bulan."
              onInput={(termMonths) => updateDraft({ termMonths })}
            />
            <label class="kpr-field" for="kpr-model">
              <span>Model amortisasi</span>
              <select
                id="kpr-model"
                name="kpr-model"
                value={draft.model}
                onChange={(event) =>
                  updateDraft({ model: event.currentTarget.value as KprModel })
                }
              >
                <option value="annuity">Anuitas — angsuran terjadwal tetap per periode bunga</option>
                <option value="flat">Flat — bunga dihitung dari pokok awal</option>
                <option value="effective">Efektif — pokok rata, bunga dari saldo</option>
              </select>
            </label>
            <RateField
              id="kpr-rate"
              label="Suku bunga awal"
              value={draft.annualRate}
              hint="Nominal per tahun. Gunakan koma untuk desimal, mis. 6,5."
              onInput={(annualRate) => updateDraft({ annualRate })}
            />
          </div>
        </fieldset>

        <fieldset class="kpr-section">
          <legend>Skenario bunga</legend>
          <label class="kpr-checkbox-field">
            <input
              type="checkbox"
              checked={draft.hasFloatingRate}
              onChange={(event) =>
                updateDraft({ hasFloatingRate: event.currentTarget.checked })
              }
            />
            <span>Simulasikan bunga tetap lalu mengambang</span>
          </label>
          {draft.hasFloatingRate && (
            <div class="kpr-grid kpr-floating-grid">
              <NumberField
                id="kpr-fixed-months"
                label="Periode bunga tetap"
                value={draft.fixedMonths}
                placeholder="Contoh: 36"
                hint="Jumlah bulan sebelum suku bunga berubah."
                onInput={(fixedMonths) => updateDraft({ fixedMonths })}
              />
              <RateField
                id="kpr-floating-rate"
                label="Suku bunga setelah periode tetap"
                value={draft.floatingRate}
                hint="Asumsi tingkat bunga untuk sisa tenor."
                onInput={(floatingRate) => updateDraft({ floatingRate })}
              />
            </div>
          )}
          <p class="kpr-hint">
            Konvensi yang dipakai: bunga nominal tahunan ÷ 12; pembayaran pada
            akhir bulan.
          </p>
        </fieldset>

        <fieldset class="kpr-section">
          <legend>Pelunasan pokok dipercepat (opsional)</legend>
          <div class="kpr-grid">
            <NumberField
              id="kpr-early-month"
              label="Bulan pembayaran tambahan"
              value={draft.earlyMonth}
              placeholder="Contoh: 24"
              onInput={(earlyMonth) => updateDraft({ earlyMonth })}
            />
            <NumberField
              id="kpr-early-amount"
              label="Nominal pokok tambahan"
              value={draft.earlyAmount}
              placeholder="Contoh: 25.000.000"
              onInput={(earlyAmount) => updateDraft({ earlyAmount })}
            />
          </div>
          <p class="kpr-hint">
            Pembayaran tambahan diterapkan setelah angsuran pada bulan itu.
            Tidak ada penalti atau pengembalian bunga yang diasumsikan.
          </p>
        </fieldset>

        <fieldset class="kpr-section">
          <legend>Biaya awal (opsional, terpisah dari pinjaman)</legend>
          <div class="kpr-grid">
            <NumberField
              id="kpr-provision"
              label="Provisi"
              value={draft.provision}
              placeholder="0"
              onInput={(provision) => updateDraft({ provision })}
            />
            <NumberField
              id="kpr-administration"
              label="Administrasi"
              value={draft.administration}
              placeholder="0"
              onInput={(administration) => updateDraft({ administration })}
            />
            <NumberField
              id="kpr-insurance"
              label="Asuransi"
              value={draft.insurance}
              placeholder="0"
              onInput={(insurance) => updateDraft({ insurance })}
            />
            <NumberField
              id="kpr-tax-notary"
              label="Pajak & notaris"
              value={draft.taxAndNotary}
              placeholder="0"
              onInput={(taxAndNotary) => updateDraft({ taxAndNotary })}
            />
          </div>
        </fieldset>

        <details class="kpr-section kpr-quote-details">
          <summary>Catat referensi kutipan bank (opsional)</summary>
          <p class="kpr-hint">
            Data ini hanya label untuk laporan. Suku bunga tetap harus Anda
            masukkan sendiri; aplikasi tidak mengambil atau memverifikasi
            penawaran bank.
          </p>
          <div class="kpr-grid">
            <label class="kpr-field" for="kpr-quote-product">
              <span>Nama bank / produk</span>
              <input
                id="kpr-quote-product"
                value={draft.quoteProduct}
                maxLength={120}
                onInput={(event) =>
                  updateDraft({ quoteProduct: event.currentTarget.value })
                }
              />
            </label>
            <label class="kpr-field" for="kpr-quote-date">
              <span>Tanggal kutipan</span>
              <input
                id="kpr-quote-date"
                type="date"
                value={draft.quoteDate}
                onInput={(event) =>
                  updateDraft({ quoteDate: event.currentTarget.value })
                }
              />
            </label>
            <label class="kpr-field" for="kpr-quote-valid">
              <span>Berlaku sampai</span>
              <input
                id="kpr-quote-valid"
                type="date"
                value={draft.quoteValidUntil}
                onInput={(event) =>
                  updateDraft({ quoteValidUntil: event.currentTarget.value })
                }
              />
            </label>
          </div>
        </details>

        {error && (
          <div class="kpr-error" role="alert">
            {error}
          </div>
        )}
        <button class="button button-primary kpr-submit" type="submit">
          Hitung simulasi KPR
        </button>
      </form>

      {result && (
        <section
          id="kpr-result"
          class="kpr-result"
          aria-labelledby="kpr-result-title"
          aria-live="polite"
        >
          <header class="kpr-result-header">
            <div>
              <p class="section-kicker">HASIL SIMULASI · METODE {modelLabels[result.method.model].toUpperCase()}</p>
              <h2 id="kpr-result-title">Rincian angsuran</h2>
              <p>
                Versi metode {result.method.version} · input dan hasil tidak
                dikirim ke server.
              </p>
            </div>
            <div class="kpr-result-actions no-print">
              <button type="button" onClick={copyResult}>Salin ringkasan</button>
              <a href={shareUrl} target="_blank" rel="noreferrer">Bagikan WhatsApp</a>
              <button type="button" onClick={() => window.print()}>Cetak</button>
            </div>
          </header>

          <dl class="kpr-summary">
            <div><dt>Pokok pinjaman</dt><dd>{rupiah(result.totals.principalRupiah)}</dd></div>
            <div><dt>Total bunga</dt><dd>{rupiah(result.totals.interestRupiah)}</dd></div>
            <div><dt>Total pokok terbayar</dt><dd>{rupiah(result.totals.repaidPrincipalRupiah)}</dd></div>
            <div class="kpr-total"><dt>Total angsuran terjadwal</dt><dd>{rupiah(result.totals.installmentsRupiah)}</dd></div>
            {result.totals.extraRepaymentsRupiah > 0n && (
              <div><dt>Pelunasan pokok tambahan</dt><dd>{rupiah(result.totals.extraRepaymentsRupiah)}</dd></div>
            )}
            <div><dt>Total biaya awal</dt><dd>{rupiah(result.totals.feesRupiah)}</dd></div>
            <div class="kpr-total"><dt>Total pengeluaran simulasi</dt><dd>{rupiah(result.totals.totalCashOutflowRupiah)}</dd></div>
            <div><dt>Tenor aktual</dt><dd>{result.totals.actualTermMonths} bulan</dd></div>
          </dl>

          <section class="kpr-report-section">
            <h3>Angsuran per bulan</h3>
            <div class="kpr-table-scroll">
              <table class="kpr-table">
                <caption>Jadwal amortisasi lengkap: pokok, bunga, dan saldo setelah pembayaran.</caption>
                <thead>
                  <tr>
                    <th scope="col">Bulan</th>
                    <th scope="col">Bunga / tahun</th>
                    <th scope="col">Angsuran reguler</th>
                    <th scope="col">Pokok</th>
                    <th scope="col">Bunga</th>
                    <th scope="col">Tambahan pokok</th>
                    <th scope="col">Sisa pokok</th>
                  </tr>
                </thead>
                <tbody>
                  {result.schedule.map((row) => (
                    <tr key={row.month}>
                      <th scope="row">{row.month}{row.isFinalAdjustment ? " · akhir" : ""}</th>
                      <td>{formatPercentage(row.annualRateBasisPoints)}%</td>
                      <td>{rupiah(row.installmentRupiah)}</td>
                      <td>{rupiah(row.principalRupiah)}</td>
                      <td>{rupiah(row.interestRupiah)}</td>
                      <td>{rupiah(row.extraPrincipalRupiah)}</td>
                      <td>{rupiah(row.closingBalanceRupiah)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section class="kpr-report-section">
            <h3>Biaya yang tetap terpisah</h3>
            <dl class="kpr-cost-list">
              {(Object.entries(result.costs) as [
                keyof KprCalculation["costs"],
                bigint,
              ][]).map(([key, value]) => (
                <div key={key}><dt>{costLabel(key)}</dt><dd>{rupiah(value)}</dd></div>
              ))}
            </dl>
          </section>

          <section class="kpr-report-section">
            <h3>Metode, asumsi, dan batas</h3>
            <p>
              {result.method.model === "annuity" &&
                "Anuitas: bunga = saldo awal × bunga bulanan; pokok = angsuran − bunga. Angsuran dihitung ulang saat bunga berubah dan setelah pembayaran pokok tambahan."}
              {result.method.model === "flat" &&
                "Flat: pokok dibagi merata; bunga dihitung dari pokok awal setiap bulan."}
              {result.method.model === "effective" &&
                "Efektif: pokok dibagi merata; bunga dihitung dari saldo pokok awal setiap bulan."}
            </p>
            {result.assumptions.map((assumption) => <p key={assumption}>• {assumption}</p>)}
            {result.warnings.map((warning) => <p class="kpr-warning" key={warning}>Peringatan: {warning}</p>)}
            {(draft.quoteProduct || draft.quoteDate || draft.quoteValidUntil) && (
              <p>
                Referensi yang dicatat pengguna: {draft.quoteProduct} · kutipan
                {` ${draft.quoteDate}`} · berlaku sampai {draft.quoteValidUntil}.
                Referensi ini tidak diverifikasi aplikasi.
              </p>
            )}
            <p class="kpr-provenance">
              Acuan metode: definisi matematis KPR dalam rencana JOBENAPP dan
              adendum Fase 1. Tidak ada suku bunga atau biaya eksternal yang
              disediakan sebagai tarif resmi.
            </p>
          </section>
          {notice && <p class="kpr-notice" role="status">{notice}</p>}
        </section>
      )}
    </div>
  );
}
