import { useState } from "preact/hooks";
import {
  calculateHpp,
  type HppAllocationInput,
  type HppCalculation,
} from "@jobenapp/engine";
import {
  formatPercentage,
  formatRupiah,
  parsePercentageInput,
  parseRupiahInput,
} from "@jobenapp/shared";
import "../styles/hpp-calculator.css";

interface AllocationDraft {
  readonly id: number;
  readonly label: string;
  readonly category: "overhead" | "depreciation";
  readonly method: "batch" | "per_unit" | "driver";
  readonly amount: string;
  readonly driverName: string;
  readonly batchDriverUnits: string;
  readonly totalDriverUnits: string;
}

interface HppDraft {
  readonly productionUnits: string;
  readonly materialCost: string;
  readonly waste: string;
  readonly directLabor: string;
  readonly otherDirectCost: string;
  readonly allocations: readonly AllocationDraft[];
  readonly costsComplete: boolean;
}

const initialDraft: HppDraft = {
  productionUnits: "",
  materialCost: "",
  waste: "",
  directLabor: "",
  otherDirectCost: "",
  allocations: [],
  costsComplete: false,
};

const allocationMethodLabels = {
  batch: "Biaya langsung per batch",
  per_unit: "Biaya per unit",
  driver: "Alokasi dari total biaya dengan penggerak",
} as const;

function rupiah(value: bigint): string {
  return `Rp ${formatRupiah(value)}`;
}

function parseMoney(value: string, label: string, required = false): bigint {
  const parsed = parseRupiahInput(value);
  if (parsed === null) {
    if (required) throw new Error(`${label} wajib diisi.`);
    return 0n;
  }
  return parsed;
}

function parsePositiveInteger(value: string, label: string): bigint {
  if (!/^[0-9]+$/.test(value.trim())) {
    throw new Error(`${label} harus berupa bilangan bulat.`);
  }
  const parsed = BigInt(value);
  if (parsed <= 0n) throw new Error(`${label} harus lebih besar dari nol.`);
  return parsed;
}

function NumberField({
  id,
  label,
  value,
  placeholder,
  hint,
  inputMode = "numeric",
  onInput,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly placeholder?: string;
  readonly hint?: string;
  readonly inputMode?: "numeric" | "decimal";
  readonly onInput: (value: string) => void;
}) {
  return (
    <label class="hpp-field" for={id}>
      <span>{label}</span>
      <input
        id={id}
        name={id}
        type="text"
        inputMode={inputMode}
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

function shareText(result: HppCalculation): string {
  return [
    "Kalkulator HPP JOBENAPP",
    `Total biaya batch: ${rupiah(result.totals.batchRupiah)}`,
    `HPP per unit: ${rupiah(result.totals.perUnitRupiah)}`,
    `Hasil produksi: ${formatRupiah(result.input.productionUnits)} unit`,
    `Biaya bahan setelah susut: ${rupiah(result.totals.materialRupiah)}`,
    `Biaya langsung: ${rupiah(result.totals.directCostRupiah)}`,
    `Overhead: ${rupiah(result.totals.overheadRupiah)}`,
    `Penyusutan: ${rupiah(result.totals.depreciationRupiah)}`,
    `Metode: ${result.method.key} v${result.method.version}`,
    result.status === "complete" ? "Status: biaya dinyatakan lengkap oleh pengguna." : "Status: sementara; biaya belum dikonfirmasi lengkap.",
    "Hasil berdasarkan input dan metode alokasi pengguna, bukan standar biaya produk.",
  ].join("\n");
}

export default function HppCalculator() {
  const [draft, setDraft] = useState<HppDraft>(initialDraft);
  const [nextAllocationId, setNextAllocationId] = useState(1);
  const [result, setResult] = useState<HppCalculation | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const updateDraft = (patch: Partial<HppDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setResult(null);
    setError("");
    setNotice("");
  };

  const updateAllocation = (id: number, patch: Partial<AllocationDraft>) => {
    updateDraft({
      allocations: draft.allocations.map((allocation) =>
        allocation.id === id ? { ...allocation, ...patch } : allocation,
      ),
    });
  };

  const addAllocation = () => {
    const id = nextAllocationId;
    setNextAllocationId((current) => current + 1);
    updateDraft({
      allocations: [
        ...draft.allocations,
        {
          id,
          label: "",
          category: "overhead",
          method: "driver",
          amount: "",
          driverName: "",
          batchDriverUnits: "",
          totalDriverUnits: "",
        },
      ],
    });
  };

  const calculate = (event: SubmitEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      const productionUnits = parsePositiveInteger(draft.productionUnits, "Hasil produksi");
      const wasteBasisPoints = draft.waste.trim()
        ? parsePercentageInput(draft.waste)
        : 0n;
      if (wasteBasisPoints === null) throw new Error("Persentase susut wajib berupa angka.");

      const allocations: HppAllocationInput[] = draft.allocations.map((allocation) => {
        if (!allocation.label.trim()) {
          throw new Error("Beri nama setiap biaya tidak langsung atau hapus barisnya.");
        }
        const input: HppAllocationInput = {
          label: allocation.label.trim(),
          category: allocation.category,
          method: allocation.method,
          amountRupiah: parseMoney(
            allocation.amount,
            allocation.method === "per_unit" ? `Biaya per unit untuk ${allocation.label}` : `Biaya untuk ${allocation.label}`,
            true,
          ),
          ...(allocation.method === "driver"
            ? {
                driverName: allocation.driverName,
                batchDriverUnits: parsePositiveInteger(
                  allocation.batchDriverUnits,
                  `Pemakaian penggerak batch untuk ${allocation.label}`,
                ),
                totalDriverUnits: parsePositiveInteger(
                  allocation.totalDriverUnits,
                  `Total penggerak untuk ${allocation.label}`,
                ),
              }
            : {}),
        };
        return input;
      });

      const calculation = calculateHpp({
        productionUnits,
        materialCostRupiah: parseMoney(draft.materialCost, "Biaya bahan", true),
        materialWasteBasisPoints: wasteBasisPoints,
        directLaborRupiah: parseMoney(draft.directLabor, "Tenaga kerja langsung"),
        otherDirectCostRupiah: parseMoney(draft.otherDirectCost, "Biaya langsung lainnya"),
        allocations,
        costsComplete: draft.costsComplete,
      });
      setResult(calculation);
      document.getElementById("hpp-result")?.scrollIntoView?.({
        behavior: "smooth",
        block: "start",
      });
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : "HPP tidak dapat dihitung dari input ini.");
    }
  };

  const copyResult = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(shareText(result));
      setNotice("Ringkasan HPP berhasil disalin.");
    } catch {
      setNotice("Browser tidak mengizinkan penyalinan otomatis. Pilih teks hasil lalu salin secara manual.");
    }
  };

  const shareResult = async () => {
    if (!result) return;
    const text = shareText(result);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Kalkulator HPP JOBENAPP", text });
        setNotice("Ringkasan HPP siap dibagikan.");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setNotice("Fitur bagikan tidak tersedia; ringkasan HPP disalin.");
      } else {
        setNotice("Fitur bagikan tidak tersedia pada browser ini.");
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      setNotice("Ringkasan HPP tidak dapat dibagikan dari browser ini.");
    }
  };

  return (
    <div class="hpp-calculator">
      <div class="hpp-local-notice">
        <span aria-hidden="true">✓</span>
        <p>Perhitungan berjalan di perangkat ini. Nilai biaya yang Anda masukkan tidak dikirim ke server.</p>
      </div>

      <form class="hpp-form" onSubmit={calculate} noValidate>
        <fieldset class="hpp-section">
          <legend>01 · Hasil dan biaya langsung</legend>
          <p class="hpp-hint">Masukkan biaya untuk satu batch produksi. HPP per unit memakai jumlah unit jadi yang dapat dijual.</p>
          <div class="hpp-grid">
            <NumberField
              id="hpp-production-units"
              label="Hasil produksi (unit jadi)"
              value={draft.productionUnits}
              placeholder="Contoh: 100"
              onInput={(productionUnits) => updateDraft({ productionUnits })}
            />
            <NumberField
              id="hpp-material-cost"
              label="Biaya bahan sebelum susut"
              value={draft.materialCost}
              placeholder="Contoh: 1.500.000"
              hint="Total biaya bahan untuk batch ini."
              onInput={(materialCost) => updateDraft({ materialCost })}
            />
            <NumberField
              id="hpp-waste"
              label="Susut bahan (opsional)"
              value={draft.waste}
              placeholder="Contoh: 5"
              inputMode="decimal"
              hint="Persen bahan terbuang dari kebutuhan total; kosongkan atau isi 0 jika tidak digunakan."
              onInput={(waste) => updateDraft({ waste })}
            />
            <NumberField
              id="hpp-direct-labor"
              label="Tenaga kerja langsung"
              value={draft.directLabor}
              placeholder="Contoh: 500.000"
              hint="Biaya tenaga kerja untuk satu batch."
              onInput={(directLabor) => updateDraft({ directLabor })}
            />
            <NumberField
              id="hpp-other-direct-cost"
              label="Biaya langsung lainnya (opsional)"
              value={draft.otherDirectCost}
              placeholder="Contoh: 150.000"
              hint="Misalnya bahan kemasan khusus atau biaya produksi langsung lain."
              onInput={(otherDirectCost) => updateDraft({ otherDirectCost })}
            />
          </div>
        </fieldset>

        <fieldset class="hpp-section">
          <legend>02 · Overhead dan penyusutan</legend>
          <p class="hpp-hint">Pilih metode untuk setiap biaya. Tidak ada overhead atau penyusutan yang ditambahkan diam-diam.</p>
          {draft.allocations.length > 0 && (
            <div class="hpp-allocation-list">
              {draft.allocations.map((allocation, index) => (
                <section class="hpp-allocation" key={allocation.id} aria-label={`Biaya tidak langsung ${index + 1}`}>
                  <div class="hpp-allocation-header">
                    <h3>Biaya tidak langsung {index + 1}</h3>
                    <button
                      type="button"
                      class="hpp-remove"
                      onClick={() =>
                        updateDraft({
                          allocations: draft.allocations.filter((item) => item.id !== allocation.id),
                        })
                      }
                    >
                      Hapus
                    </button>
                  </div>
                  <div class="hpp-grid">
                    <label class="hpp-field" for={`hpp-cost-label-${allocation.id}`}>
                      <span>Nama biaya</span>
                      <input
                        id={`hpp-cost-label-${allocation.id}`}
                        value={allocation.label}
                        placeholder="Contoh: listrik produksi"
                        onInput={(event) => updateAllocation(allocation.id, { label: event.currentTarget.value })}
                      />
                    </label>
                    <label class="hpp-field" for={`hpp-cost-category-${allocation.id}`}>
                      <span>Kategori</span>
                      <select
                        id={`hpp-cost-category-${allocation.id}`}
                        value={allocation.category}
                        onChange={(event) =>
                          updateAllocation(allocation.id, {
                            category: event.currentTarget.value as AllocationDraft["category"],
                          })
                        }
                      >
                        <option value="overhead">Overhead</option>
                        <option value="depreciation">Penyusutan</option>
                      </select>
                    </label>
                    <label class="hpp-field" for={`hpp-cost-method-${allocation.id}`}>
                      <span>Metode alokasi</span>
                      <select
                        id={`hpp-cost-method-${allocation.id}`}
                        value={allocation.method}
                        onChange={(event) =>
                          updateAllocation(allocation.id, {
                            method: event.currentTarget.value as AllocationDraft["method"],
                          })
                        }
                      >
                        {Object.entries(allocationMethodLabels).map(([value, label]) => (
                          <option value={value}>{label}</option>
                        ))}
                      </select>
                    </label>
                    <NumberField
                      id={`hpp-cost-amount-${allocation.id}`}
                      label={
                        allocation.method === "per_unit"
                          ? "Biaya per unit"
                          : allocation.method === "driver"
                            ? "Total biaya dalam pool"
                            : "Biaya untuk batch ini"
                      }
                      value={allocation.amount}
                      placeholder="Contoh: 250.000"
                      onInput={(amount) => updateAllocation(allocation.id, { amount })}
                    />
                    {allocation.method === "driver" && (
                      <>
                        <label class="hpp-field" for={`hpp-driver-name-${allocation.id}`}>
                          <span>Nama penggerak alokasi</span>
                          <input
                            id={`hpp-driver-name-${allocation.id}`}
                            value={allocation.driverName}
                            placeholder="Contoh: jam mesin"
                            onInput={(event) => updateAllocation(allocation.id, { driverName: event.currentTarget.value })}
                          />
                        </label>
                        <NumberField
                          id={`hpp-batch-driver-${allocation.id}`}
                          label="Pemakaian penggerak batch"
                          value={allocation.batchDriverUnits}
                          placeholder="Contoh: 8"
                          onInput={(batchDriverUnits) => updateAllocation(allocation.id, { batchDriverUnits })}
                        />
                        <NumberField
                          id={`hpp-total-driver-${allocation.id}`}
                          label="Total penggerak untuk semua produksi"
                          value={allocation.totalDriverUnits}
                          placeholder="Contoh: 40"
                          hint="Gunakan satuan dan periode yang sama dengan pemakaian batch."
                          onInput={(totalDriverUnits) => updateAllocation(allocation.id, { totalDriverUnits })}
                        />
                      </>
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
          <button type="button" class="hpp-add" onClick={addAllocation}>
            <span aria-hidden="true">＋</span> Tambah overhead atau penyusutan
          </button>
        </fieldset>

        <label class="hpp-complete-check">
          <input
            type="checkbox"
            checked={draft.costsComplete}
            onChange={(event) => updateDraft({ costsComplete: event.currentTarget.checked })}
          />
          <span>Saya sudah memasukkan semua biaya langsung, overhead, penyusutan, dan susut yang berlaku untuk batch ini.</span>
        </label>

        {error && <p class="hpp-error" role="alert">{error}</p>}
        <button type="submit" class="button button-primary hpp-submit">Hitung HPP</button>
      </form>

      {result && (
        <section class="hpp-result" id="hpp-result" aria-live="polite" aria-labelledby="hpp-result-title">
          <div class="hpp-result-header">
            <div>
              <p class="section-kicker">HASIL PERHITUNGAN · METODE v{result.method.version}</p>
              <h2 id="hpp-result-title">HPP produksi Anda</h2>
              <p>
                {result.status === "complete"
                  ? "Biaya ditandai lengkap berdasarkan konfirmasi Anda."
                  : "Hasil sementara karena kelengkapan biaya belum dikonfirmasi."}
              </p>
            </div>
            <div class="hpp-result-actions" aria-label="Tindakan hasil">
              <button type="button" onClick={copyResult}>Salin</button>
              <button type="button" onClick={shareResult}>Bagikan</button>
              <button type="button" onClick={() => window.print()}>Cetak / PDF</button>
            </div>
          </div>

          {result.status === "provisional" && (
            <p class="hpp-warning" role="status">{result.warnings[0]}</p>
          )}
          <div class="hpp-total-cards">
            <article>
              <span>Total biaya batch</span>
              <strong>{rupiah(result.totals.batchRupiah)}</strong>
              <small>{formatRupiah(result.input.productionUnits)} unit hasil produksi</small>
            </article>
            <article class="hpp-per-unit">
              <span>HPP per unit</span>
              <strong>{rupiah(result.totals.perUnitRupiah)}</strong>
              <small>Total biaya batch ÷ jumlah unit jadi</small>
            </article>
          </div>

          <div class="hpp-report-section">
            <h3>Rincian biaya</h3>
            <div class="hpp-table-wrap">
              <table class="hpp-table">
                <thead>
                  <tr><th>Komponen</th><th>Metode / dasar</th><th>Jumlah</th></tr>
                </thead>
                <tbody>
                  {result.lines.map((line, index) => (
                    <tr key={`${line.label}-${index}`}>
                      <th scope="row">{line.label}</th>
                      <td>
                        {line.category === "material" && result.input.materialWasteBasisPoints > 0n
                          ? `Penyesuaian susut ${formatPercentage(result.input.materialWasteBasisPoints)}%`
                          : line.method}
                      </td>
                      <td>{rupiah(line.amountRupiah)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><th scope="row" colSpan={2}>Total biaya batch</th><td>{rupiah(result.totals.batchRupiah)}</td></tr>
                  <tr><th scope="row" colSpan={2}>HPP per unit</th><td>{rupiah(result.totals.perUnitRupiah)}</td></tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div class="hpp-result-context">
            <div class="hpp-report-section">
              <h3>Asumsi dan pembulatan</h3>
              <ul>{result.assumptions.map((assumption) => <li>{assumption}</li>)}</ul>
            </div>
            <div class="hpp-provenance">
              <h3>Metode dan batas penggunaan</h3>
              <p>Perhitungan aritmetika deterministik tanpa tarif eksternal. Biaya pool dibagi menurut penggerak yang Anda masukkan; hasil bukan standar biaya atau harga produk.</p>
              <p>Pembulatan: {result.method.rounding}. Versi metode {result.method.version}.</p>
            </div>
          </div>
          {notice && <p class="hpp-notice" role="status">{notice}</p>}
        </section>
      )}
    </div>
  );
}
