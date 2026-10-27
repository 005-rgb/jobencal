import { useState } from "preact/hooks";
import {
  calculateVehicleInstallment,
  type VehicleInstallmentCalculation,
  type VehicleInstallmentInput,
  type VehicleCostKey,
} from "@jobenapp/engine";
import {
  formatRupiah,
  parsePercentageInput,
  parseRupiahInput,
} from "@jobenapp/shared";
import "../styles/vehicle-installment-calculator.css";

type Model = VehicleInstallmentInput["model"];
type CostPayment = "upfront" | "financed";
type CostDraft = {
  amount: string;
  payment: CostPayment;
};

interface Draft {
  vehiclePrice: string;
  downPayment: string;
  months: string;
  rate: string;
  model: Model;
  administration: CostDraft;
  insurance: CostDraft;
  other: CostDraft;
  provider: string;
  product: string;
  sourceUrl: string;
  quoteDate: string;
  validUntil: string;
}

const initialDraft: Draft = {
  vehiclePrice: "",
  downPayment: "",
  months: "",
  rate: "",
  model: "annuity",
  administration: { amount: "", payment: "upfront" },
  insurance: { amount: "", payment: "upfront" },
  other: { amount: "", payment: "upfront" },
  provider: "",
  product: "",
  sourceUrl: "",
  quoteDate: "",
  validUntil: "",
};

const modelLabels: Readonly<Record<Model, string>> = {
  annuity: "Anuitas",
  flat: "Flat",
  effective: "Efektif",
};

const costLabels: Readonly<Record<VehicleCostKey, string>> = {
  administration: "Administrasi",
  insurance: "Asuransi / produk tambahan",
  other: "Biaya atau produk lain",
};

function rupiah(value: bigint): string {
  return `Rp ${formatRupiah(value)}`;
}

function requiredRupiah(value: string, label: string): bigint {
  const result = parseRupiahInput(value);
  if (result === null) throw new Error(`${label} wajib diisi.`);
  return result;
}

function optionalCost(value: string, label: string): bigint | undefined {
  if (!value.trim()) return undefined;
  return requiredRupiah(value, label);
}

function rateBasisPoints(value: string): bigint {
  const result = parsePercentageInput(value);
  if (result === null) throw new Error("Bunga tahunan wajib diisi.");
  return result;
}

function numberField(
  id: string,
  label: string,
  value: string,
  onInput: (value: string) => void,
  hint?: string,
) {
  return (
    <label class="vehicle-field" for={id}>
      <span>{label}</span>
      <input
        id={id}
        name={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        placeholder="Contoh: 150.000.000"
        aria-describedby={hint ? `${id}-hint` : undefined}
        onInput={(event) => onInput(event.currentTarget.value)}
      />
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </label>
  );
}

function createReport(result: VehicleInstallmentCalculation): string {
  const { totals } = result;
  return [
    "Simulasi Cicilan Kendaraan · JOBENAPP",
    `Metode: ${modelLabels[result.method.model]}`,
    `Harga kendaraan: ${rupiah(totals.vehiclePriceRupiah)}`,
    `Uang muka: ${rupiah(totals.downPaymentRupiah)}`,
    `Pokok pembiayaan: ${rupiah(totals.principalRupiah)}`,
    `Bunga total: ${rupiah(totals.interestRupiah)}`,
    `Angsuran pertama: ${rupiah(totals.firstInstallmentRupiah)}`,
    `Angsuran terakhir: ${rupiah(totals.lastInstallmentRupiah)}`,
    `Total angsuran: ${rupiah(totals.installmentsRupiah)}`,
    `Total saat penandatanganan: ${rupiah(totals.cashAtSigningRupiah)}`,
    `Total pengeluaran: ${rupiah(totals.totalCashOutflowRupiah)}`,
    "Simulasi asumsi pengguna, bukan tarif pasar atau penawaran pembiayaan.",
  ].join("\n");
}

function CostField({
  id,
  label,
  draft,
  onUpdate,
}: {
  readonly id: VehicleCostKey;
  readonly label: string;
  readonly draft: CostDraft;
  readonly onUpdate: (patch: Partial<CostDraft>) => void;
}) {
  return (
    <div class="vehicle-cost-field">
      <label class="vehicle-field" for={`vehicle-${id}`}>
        <span>{label}</span>
        <input
          id={`vehicle-${id}`}
          name={`vehicle-${id}`}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={draft.amount}
          placeholder="Opsional"
          onInput={(event) => onUpdate({ amount: event.currentTarget.value })}
        />
      </label>
      <label class="vehicle-field" for={`vehicle-${id}-payment`}>
        <span>Cara bayar</span>
        <select
          id={`vehicle-${id}-payment`}
          value={draft.payment}
          onChange={(event) =>
            onUpdate({ payment: event.currentTarget.value as CostPayment })
          }
        >
          <option value="upfront">Dibayar di awal</option>
          <option value="financed">Masuk pembiayaan</option>
        </select>
      </label>
    </div>
  );
}

export default function VehicleInstallmentCalculator() {
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [result, setResult] = useState<VehicleInstallmentCalculation | null>(
    null,
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const update = (patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setResult(null);
    setError("");
    setNotice("");
  };

  const updateCost = (
    key: VehicleCostKey,
    patch: Partial<CostDraft>,
  ) => {
    setDraft((current) => ({
      ...current,
      [key]: { ...current[key], ...patch },
    }));
    setResult(null);
    setError("");
    setNotice("");
  };

  const calculate = (event: SubmitEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      if (!/^[0-9]+$/.test(draft.months)) {
        throw new Error("Tenor wajib berupa bilangan bulat bulan.");
      }
      const quoteMetadata = [
        draft.provider.trim(),
        draft.product.trim(),
        draft.sourceUrl.trim(),
        draft.quoteDate,
        draft.validUntil,
      ];
      if (quoteMetadata.some(Boolean) && quoteMetadata.some((value) => !value)) {
        throw new Error(
          "Lengkapi pemberi pembiayaan, produk, URL sumber, tanggal kutipan, dan masa berlakunya; atau kosongkan semuanya.",
        );
      }
      if (draft.sourceUrl) {
        let sourceUrl: URL;
        try {
          sourceUrl = new URL(draft.sourceUrl);
        } catch {
          throw new Error("URL sumber kutipan harus berupa alamat yang valid.");
        }
        if (sourceUrl.protocol !== "https:" && sourceUrl.protocol !== "http:") {
          throw new Error("URL sumber kutipan harus menggunakan HTTP atau HTTPS.");
        }
      }
      if (draft.quoteDate && draft.validUntil < draft.quoteDate) {
        throw new Error("Masa berlaku kutipan tidak boleh sebelum tanggal kutipan.");
      }

      const rawCosts = {
        administration: {
          amountRupiah: optionalCost(
            draft.administration.amount,
            "Biaya administrasi",
          ),
          payment: draft.administration.payment,
        },
        insurance: {
          amountRupiah: optionalCost(draft.insurance.amount, "Biaya asuransi"),
          payment: draft.insurance.payment,
        },
        other: {
          amountRupiah: optionalCost(draft.other.amount, "Biaya lain"),
          payment: draft.other.payment,
        },
      };
      const costs: Partial<
        Record<VehicleCostKey, { amountRupiah: bigint; payment: CostPayment }>
      > = {};
      for (const key of Object.keys(rawCosts) as VehicleCostKey[]) {
        const cost = rawCosts[key];
        if (cost.amountRupiah !== undefined) {
          costs[key] = {
            amountRupiah: cost.amountRupiah,
            payment: cost.payment,
          };
        }
      }

      const nextResult = calculateVehicleInstallment({
        vehiclePriceRupiah: requiredRupiah(
          draft.vehiclePrice,
          "Harga kendaraan",
        ),
        downPaymentRupiah: requiredRupiah(draft.downPayment, "Uang muka"),
        termMonths: Number(draft.months),
        model: draft.model,
        annualRateBasisPoints: rateBasisPoints(draft.rate),
        ...(Object.keys(costs).length ? { costs } : {}),
      });
      setResult(nextResult);
    } catch (caught) {
      setResult(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "Simulasi tidak dapat dihitung. Periksa kembali input.",
      );
    }
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(createReport(result));
      setNotice("Ringkasan simulasi disalin.");
    } catch {
      setNotice("Penyalinan otomatis tidak tersedia di browser ini.");
    }
  };

  const share = async () => {
    if (!result) return;
    const text = createReport(result);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Simulasi Cicilan Kendaraan", text });
      } else {
        await navigator.clipboard.writeText(text);
        setNotice("Ringkasan disalin untuk dibagikan.");
      }
    } catch {
      setNotice("Pembagian dibatalkan atau tidak tersedia.");
    }
  };

  const costs = [
    ["administration", costLabels.administration, draft.administration],
    ["insurance", costLabels.insurance, draft.insurance],
    ["other", costLabels.other, draft.other],
  ] as const;
  const costDetailRows = costs.map(([key, label, cost]) => {
    const amount = cost.amount.trim()
      ? parseRupiahInput(cost.amount)
      : null;
    return amount === null
      ? null
      : (
          <li key={key}>
            {label}: {rupiah(amount)} ·{" "}
            {cost.payment === "financed" ? "masuk pokok pembiayaan" : "dibayar di awal"}
          </li>
        );
  });

  return (
    <div class="vehicle-calculator">
      <form class="vehicle-form" onSubmit={calculate}>
        <div class="vehicle-form-intro">
          <h2>Simulasikan biaya pembiayaan kendaraan</h2>
          <p>
            Masukkan asumsi yang ingin dibandingkan. Hasil dihitung di browser
            ini; data input tidak dikirim untuk diproses.
          </p>
        </div>
        <div class="vehicle-form-grid">
          {numberField("vehicle-price", "Harga kendaraan", draft.vehiclePrice, (vehiclePrice) =>
            update({ vehiclePrice }),
          )}
          {numberField("vehicle-down-payment", "Uang muka", draft.downPayment, (downPayment) =>
            update({ downPayment }),
          )}
          <label class="vehicle-field" for="vehicle-term">
            <span>Tenor</span>
            <div class="vehicle-input-suffix">
              <input
                id="vehicle-term"
                name="vehicle-term"
                type="number"
                min="1"
                max="360"
                step="1"
                inputMode="numeric"
                value={draft.months}
                placeholder="Contoh: 36"
                onInput={(event) => update({ months: event.currentTarget.value })}
              />
              <span>bulan</span>
            </div>
            <small>1–360 bulan</small>
          </label>
          <label class="vehicle-field" for="vehicle-rate">
            <span>Bunga nominal tahunan</span>
            <div class="vehicle-input-suffix">
              <input
                id="vehicle-rate"
                name="vehicle-rate"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={draft.rate}
                placeholder="Contoh: 8,5"
                onInput={(event) => update({ rate: event.currentTarget.value })}
              />
              <span>% / tahun</span>
            </div>
            <small>
              Basis tahunan dibagi 12. Masukkan persentase sesuai dokumen atau
              asumsi Anda.
            </small>
          </label>
          <label class="vehicle-field" for="vehicle-model">
            <span>Metode angsuran</span>
            <select
              id="vehicle-model"
              value={draft.model}
              onChange={(event) =>
                update({ model: event.currentTarget.value as Model })
              }
            >
              <option value="annuity">Anuitas</option>
              <option value="flat">Flat</option>
              <option value="effective">Efektif</option>
            </select>
          </label>
        </div>

        <fieldset class="vehicle-costs">
          <legend>Biaya dan produk tambahan</legend>
          <p class="vehicle-section-hint">
            Biaya kosong tidak dihitung. Pilih apakah setiap nilai dibayar di
            awal atau ikut dibiayai.
          </p>
          <div class="vehicle-cost-grid">
            {costs.map(([key, label, cost]) => (
              <CostField
                id={key}
                label={label}
                draft={cost}
                onUpdate={(patch) => updateCost(key, patch)}
              />
            ))}
          </div>
        </fieldset>

        <details class="vehicle-quote-details">
          <summary>Catat referensi kutipan produk (opsional)</summary>
          <p>
            Isian ini hanya catatan Anda; JOBENAPP tidak memeriksa atau mengesahkan kutipan.
          </p>
          <div class="vehicle-form-grid">
            <label class="vehicle-field" for="vehicle-provider">
              <span>Pemberi pembiayaan</span>
              <input id="vehicle-provider" value={draft.provider} onInput={(event) => update({ provider: event.currentTarget.value })} />
            </label>
            <label class="vehicle-field" for="vehicle-product">
              <span>Nama produk</span>
              <input id="vehicle-product" value={draft.product} onInput={(event) => update({ product: event.currentTarget.value })} />
            </label>
            <label class="vehicle-field" for="vehicle-source-url">
              <span>URL sumber kutipan</span>
              <input id="vehicle-source-url" type="url" value={draft.sourceUrl} onInput={(event) => update({ sourceUrl: event.currentTarget.value })} />
            </label>
            <label class="vehicle-field" for="vehicle-quote-date">
              <span>Tanggal kutipan</span>
              <input id="vehicle-quote-date" type="date" value={draft.quoteDate} onInput={(event) => update({ quoteDate: event.currentTarget.value })} />
            </label>
            <label class="vehicle-field" for="vehicle-valid-until">
              <span>Berlaku sampai</span>
              <input id="vehicle-valid-until" type="date" value={draft.validUntil} onInput={(event) => update({ validUntil: event.currentTarget.value })} />
            </label>
          </div>
        </details>
        <button class="button button-primary vehicle-submit" type="submit">
          Hitung simulasi
        </button>
        {error && <p class="vehicle-error" role="alert">{error}</p>}
      </form>

      {result && (
        <section class="vehicle-result" aria-labelledby="vehicle-result-title">
          <div class="vehicle-result-heading">
            <div>
              <p class="section-kicker">HASIL SIMULASI PENGGUNA</p>
              <h2 id="vehicle-result-title">Rincian cicilan kendaraan</h2>
            </div>
            <span class="vehicle-method-badge">{modelLabels[result.method.model]}</span>
          </div>
          <dl class="vehicle-summary">
            <div><dt>Harga kendaraan</dt><dd>{rupiah(result.totals.vehiclePriceRupiah)}</dd></div>
            <div><dt>Uang muka</dt><dd>{rupiah(result.totals.downPaymentRupiah)}</dd></div>
            <div><dt>Pokok pembiayaan</dt><dd>{rupiah(result.totals.principalRupiah)}</dd></div>
            <div><dt>Biaya masuk pokok pembiayaan</dt><dd>{rupiah(result.totals.financedCostsRupiah)}</dd></div>
            <div><dt>Bunga total</dt><dd>{rupiah(result.totals.interestRupiah)}</dd></div>
            <div><dt>Angsuran pertama</dt><dd>{rupiah(result.totals.firstInstallmentRupiah)}</dd></div>
            <div><dt>Angsuran terakhir</dt><dd>{rupiah(result.totals.lastInstallmentRupiah)}</dd></div>
            <div><dt>Total biaya dibayar di awal</dt><dd>{rupiah(result.totals.upfrontCostsRupiah)}</dd></div>
            <div><dt>Total saat penandatanganan</dt><dd>{rupiah(result.totals.cashAtSigningRupiah)}</dd></div>
            <div class="vehicle-total-row"><dt>Total seluruh angsuran</dt><dd>{rupiah(result.totals.installmentsRupiah)}</dd></div>
            <div class="vehicle-total-row vehicle-total-final"><dt>Total pengeluaran simulasi</dt><dd>{rupiah(result.totals.totalCashOutflowRupiah)}</dd></div>
          </dl>
          {costDetailRows.some(Boolean) && (
            <div class="vehicle-cost-result">
              <h3>Rincian biaya input</h3>
              <ul>{costDetailRows}</ul>
            </div>
          )}

          {(draft.provider || draft.product) && (
            <p class="vehicle-quote-note">
              Catatan kutipan pengguna: {draft.provider} · {draft.product} ·
              {draft.quoteDate} sampai {draft.validUntil}.{" "}
              <a href={draft.sourceUrl} target="_blank" rel="noreferrer">Lihat sumber</a>.
              Belum diverifikasi.
            </p>
          )}

          <div class="vehicle-schedule-heading">
            <div><h3>Jadwal angsuran</h3><p>{result.totals.actualTermMonths} bulan · bunga dihitung per bulan</p></div>
            <div class="vehicle-actions">
              <button type="button" onClick={copy}>Salin</button>
              <button type="button" onClick={share}>Bagikan</button>
              <button type="button" onClick={() => window.print()}>Cetak</button>
            </div>
          </div>
          <div class="vehicle-schedule-scroll" role="region" aria-label="Jadwal angsuran per bulan" tabIndex={0}>
            <table class="vehicle-schedule">
              <thead><tr><th scope="col">Bulan</th><th scope="col">Saldo awal</th><th scope="col">Angsuran</th><th scope="col">Pokok</th><th scope="col">Bunga</th><th scope="col">Saldo akhir</th></tr></thead>
              <tbody>
                {result.schedule.map((row) => (
                  <tr>
                    <th scope="row">{row.month}</th>
                    <td>{rupiah(row.openingBalanceRupiah)}</td>
                    <td>{rupiah(row.installmentRupiah)}</td>
                    <td>{rupiah(row.principalRupiah)}</td>
                    <td>{rupiah(row.interestRupiah)}</td>
                    <td>{rupiah(row.closingBalanceRupiah)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div class="vehicle-assumptions">
            <h3>Metode dan batas simulasi</h3>
            <ul>{result.assumptions.map((assumption) => <li>{assumption}</li>)}</ul>
            <ul class="vehicle-warnings">{result.warnings.map((warning) => <li>{warning}</li>)}</ul>
            <p>Metode {result.method.key}, versi {result.method.version}. Suku bunga dan biaya berasal dari input pengguna, bukan tarif terverifikasi.</p>
          </div>
          {notice && <p class="vehicle-notice" role="status">{notice}</p>}
        </section>
      )}
    </div>
  );
}
