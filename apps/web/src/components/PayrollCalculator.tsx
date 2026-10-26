import { useState } from "preact/hooks";
import type { TargetedSubmitEvent } from "preact";
import {
  BPJS_PROGRAM_CODES,
  calculateNetSalary,
  type BpjsProgramCode,
  type NetSalaryCalculation,
  type PayrollTaxRuleData,
} from "@jobenapp/engine";
import { formatPercentage, formatRupiah } from "@jobenapp/shared";
import {
  evaluatePayrollReadiness,
  payrollReleaseData,
} from "../data/payroll-release.js";
import {
  buildPayrollCalculationInput,
  createPayrollFormDraft,
  getHistoryMonthDraft,
  getWageBaseGroups,
  monthName,
  type CompensationDraft,
  type MonthDraft,
  type PayrollFormDraft,
} from "./payroll-form.js";

const PROGRAM_NAMES: Readonly<Record<BpjsProgramCode, string>> = {
  jkn: "Jaminan Kesehatan Nasional",
  jht: "Jaminan Hari Tua",
  jp: "Jaminan Pensiun",
  jkk: "Jaminan Kecelakaan Kerja",
  jkm: "Jaminan Kematian",
  jkp: "Jaminan Kehilangan Pekerjaan",
};

function rupiah(value: bigint): string {
  return `Rp ${formatRupiah(value)}`;
}

function RupiahField({
  id,
  label,
  value,
  required = true,
  onInput,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly required?: boolean;
  readonly onInput: (value: string) => void;
}) {
  return (
    <label class="payroll-field" for={id}>
      <span>{label}</span>
      <span class="payroll-rupiah-input">
        <span aria-hidden="true">Rp</span>
        <input
          id={id}
          name={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          required={required}
          value={value}
          placeholder="0"
          onInput={(event) => onInput(event.currentTarget.value)}
        />
      </span>
    </label>
  );
}

function wageBaseLabel(
  group: ReturnType<typeof getWageBaseGroups>[number],
): string {
  const names = group.programs.map((program) => program.toUpperCase()).join(", ");
  return `Dasar upah ${names}`;
}

function CompensationFields({
  item,
  index,
  wageGroups,
  onChange,
  onRemove,
  canRemove,
  required,
}: {
  readonly item: CompensationDraft;
  readonly index: number;
  readonly wageGroups: ReturnType<typeof getWageBaseGroups>;
  readonly onChange: (patch: Partial<CompensationDraft>) => void;
  readonly onRemove: () => void;
  readonly canRemove: boolean;
  readonly required: boolean;
}) {
  const id = `payroll-component-${item.id}`;
  return (
    <fieldset class="payroll-component">
      <legend>
        <span>Komponen {index + 1}</span>
        {canRemove && (
          <button
            class="payroll-remove-button"
            type="button"
            onClick={onRemove}
          >
            Hapus komponen
          </button>
        )}
      </legend>
      <div class="payroll-form-grid">
        <label class="payroll-field payroll-field-wide" for={`${id}-name`}>
          <span>Nama komponen</span>
          <input
            id={`${id}-name`}
            name={`${id}-name`}
            type="text"
            autoComplete="off"
            required={required}
            maxLength={80}
            value={item.description}
            placeholder="Contoh: Gaji pokok"
            onInput={(event) =>
              onChange({ description: event.currentTarget.value })
            }
          />
        </label>
        <RupiahField
          id={`${id}-amount`}
          label="Nilai komponen"
          value={item.amountRupiah}
          required={required}
          onInput={(amountRupiah) => onChange({ amountRupiah })}
        />
        <RupiahField
          id={`${id}-cash`}
          label="Nilai tunai dibayar"
          value={item.cashPayableRupiah}
          required={required}
          onInput={(cashPayableRupiah) => onChange({ cashPayableRupiah })}
        />
        <RupiahField
          id={`${id}-taxable`}
          label="Nilai bruto kena PPh 21"
          value={item.taxablePph21Rupiah}
          required={required}
          onInput={(taxablePph21Rupiah) =>
            onChange({ taxablePph21Rupiah })
          }
        />
        {wageGroups.map((group) => (
          <RupiahField
            key={group.key}
            id={`${id}-base-${group.key}`}
            label={wageBaseLabel(group)}
            value={item.bpjsWageBasesRupiah[group.key] ?? ""}
            required={required}
            onInput={(value) =>
              onChange({
                bpjsWageBasesRupiah: {
                  ...item.bpjsWageBasesRupiah,
                  [group.key]: value,
                },
              })
            }
          />
        ))}
      </div>
      <p class="payroll-field-hint">
        Isi setiap klasifikasi dengan nilai Rupiah; gunakan 0 untuk komponen
        yang tidak termasuk suatu dasar.
      </p>
    </fieldset>
  );
}

function MonthFields({
  month,
  draft,
  taxRules,
  bpjsRules,
  history,
  onChange,
}: {
  readonly month: number;
  readonly draft: MonthDraft;
  readonly taxRules: PayrollTaxRuleData;
  readonly bpjsRules: NonNullable<typeof payrollReleaseData.bpjsRules>["data"];
  readonly history: boolean;
  readonly onChange: (next: MonthDraft) => void;
}) {
  const wageGroups = getWageBaseGroups(bpjsRules);
  const deductionCodes = taxRules.annualTaxDeductionCodes.filter(
    (code) => code !== "other_employee_deduction",
  );
  const changeCompensation = (
    id: string,
    patch: Partial<CompensationDraft>,
  ) => {
    onChange({
      ...draft,
      compensation: draft.compensation.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });
  };
  const addCompensation = () => {
    let nextId = draft.compensation.length + 1;
    while (
      draft.compensation.some((item) => item.id === `komponen-${nextId}`)
    ) {
      nextId += 1;
    }
    const bases = Object.fromEntries(
      wageGroups.map(({ key }) => [key, ""]),
    );
    onChange({
      ...draft,
      compensation: [
        ...draft.compensation,
        {
          id: `komponen-${nextId}`,
          description: "",
          amountRupiah: "",
          cashPayableRupiah: "",
          taxablePph21Rupiah: "",
          bpjsWageBasesRupiah: bases,
        },
      ],
    });
  };

  return (
    <div class="payroll-month-fields">
      {history && (
        <RupiahField
          id={`history-${month}-pph`}
          label={`PPh 21 yang benar-benar dipotong · ${monthName(month)}`}
          value={draft.pph21WithheldRupiah}
          required={!history}
          onInput={(pph21WithheldRupiah) =>
            onChange({ ...draft, pph21WithheldRupiah })
          }
        />
      )}

      <div class="payroll-component-list">
        {draft.compensation.map((item, index) => (
          <CompensationFields
            key={item.id}
            item={item}
            index={index}
            wageGroups={wageGroups}
            canRemove={draft.compensation.length > 1}
            required={!history}
            onRemove={() =>
              onChange({
                ...draft,
                compensation: draft.compensation.filter(
                  (entry) => entry.id !== item.id,
                ),
              })
            }
            onChange={(patch) => changeCompensation(item.id, patch)}
          />
        ))}
      </div>
      <button
        class="payroll-add-button"
        type="button"
        onClick={addCompensation}
      >
        + Tambah komponen penghasilan
      </button>

      {deductionCodes.length > 0 && (
        <fieldset class="payroll-deduction-fields">
          <legend>
            Potongan yang dapat mengurangi penghasilan neto tahunan
          </legend>
          <div class="payroll-form-grid">
            {deductionCodes.map((code) => (
              <RupiahField
                key={code}
                id={`month-${month}-deduction-${code}`}
                label={code}
                value={draft.employeeDeductions[code] ?? ""}
                required={!history}
                onInput={(value) =>
                  onChange({
                    ...draft,
                    employeeDeductions: {
                      ...draft.employeeDeductions,
                      [code]: value,
                    },
                  })
                }
              />
            ))}
          </div>
        </fieldset>
      )}
      {!history && (
        <RupiahField
          id="payroll-other-deduction"
          label="Potongan pegawai lain"
          value={draft.otherEmployeeDeductionRupiah}
          onInput={(otherEmployeeDeductionRupiah) =>
            onChange({ ...draft, otherEmployeeDeductionRupiah })
          }
        />
      )}
    </div>
  );
}

function csvCell(value: string): string {
  const safeValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

function createReportCsv(
  calculation: NetSalaryCalculation,
  draft: PayrollFormDraft,
  productionReady: boolean,
): string {
  const rows: string[][] = [
    ["Laporan estimasi gaji bersih JOBENAPP"],
    ["Periode", `${monthName(calculation.period.taxMonth)} ${calculation.period.taxYear}`],
    ["Status hasil", productionReady ? "Terverifikasi untuk produksi" : "Belum divalidasi untuk produksi"],
    ["Tanggal perhitungan", draft.asOfDate],
    ["Versi metode", calculation.method.version],
    ["Versi aturan PPh 21", calculation.method.taxRule.version],
    ["Versi aturan BPJS", calculation.method.bpjsRule.version],
    ["Gaji tunai", calculation.gross.cashPayableRupiah.toString()],
    ["Bruto kena PPh 21", calculation.gross.taxablePph21Rupiah.toString()],
    ["Kategori TER", calculation.tax.category],
    ["Mode pajak", calculation.tax.mode],
    ["PPh 21 periode ini", calculation.tax.currentWithholdingRupiah.toString()],
    ["Iuran BPJS pegawai", calculation.bpjs.employeeTotalRupiah.toString()],
    ["Iuran BPJS pemberi kerja", calculation.bpjs.employerTotalRupiah.toString()],
    ["Iuran BPJS pemerintah", calculation.bpjs.governmentTotalRupiah.toString()],
    ["Potongan pegawai lain", calculation.otherEmployeeDeductionsRupiah.toString()],
    ["Total potongan pegawai", calculation.totalEmployeeDeductionsRupiah.toString()],
    ["Gaji bersih", calculation.netPayRupiah.toString()],
    [],
    ["Program BPJS", "Dasar iuran", "Dasar upah", "Porsi pegawai", "Porsi pemberi kerja", "Porsi pemerintah"],
    ...calculation.bpjs.programs.map((line) => [
      line.program.toUpperCase(),
      line.participation ? "Ikut" : "Tidak ikut",
      line.contributionBaseRupiah.toString(),
      line.employeeRupiah.toString(),
      line.employerRupiah.toString(),
      line.governmentRupiah.toString(),
    ]),
    [],
    ["Komponen penghasilan", "Nilai komponen", "Nilai tunai", "Bruto kena PPh 21"],
    ...draft.currentMonth.compensation.map((item) => [
      item.description,
      item.amountRupiah,
      item.cashPayableRupiah,
      item.taxablePph21Rupiah,
    ]),
    [],
    ["Peringatan", ...calculation.warnings],
    ["Asumsi", ...calculation.assumptions],
    ["Privasi", "Input dan hasil dihitung di perangkat ini; tidak dikirim ke server."],
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

function downloadReport(
  calculation: NetSalaryCalculation,
  draft: PayrollFormDraft,
  productionReady: boolean,
): void {
  const csv = createReportCsv(calculation, draft, productionReady);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `laporan-gaji-${draft.taxYear}-${String(draft.taxMonth).padStart(2, "0")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function ReadinessPanel() {
  const readiness = evaluatePayrollReadiness(payrollReleaseData);
  const hasRules = Boolean(
    payrollReleaseData.taxRules && payrollReleaseData.bpjsRules,
  );
  return (
    <div class="payroll-calculator">
      <section class="payroll-readiness" role="status">
        <span class="payroll-readiness-icon" aria-hidden="true">!</span>
        <div>
          <strong>Formulir dan laporan nyata masih dikunci</strong>
          <p>
            Angka dalam dokumen referensi berstatus draf. Tidak ada tarif
            perkiraan atau vektor sintetis yang dipakai untuk menghitung gaji.
            Formulir hanya dibuka setelah kedua dataset aturan lolos tinjauan
            dan seluruh fixture pembanding terverifikasi.
          </p>
        </div>
        <span class="payroll-readiness-state">
          {readiness.canCalculate ? "Siap menghitung" : "Menunggu verifikasi"}
        </span>
      </section>

      <section class="payroll-gate-card" aria-labelledby="payroll-gate-title">
        <div class="payroll-gate-heading">
          <span class="payroll-report-kicker">GERBANG KELAYAKAN</span>
          <h2 id="payroll-gate-title">Yang masih harus dipenuhi</h2>
        </div>
        <ul class="payroll-gate-list">
          <li className={readiness.rulesReady ? "is-complete" : undefined}>
            <span aria-hidden="true">{readiness.rulesReady ? "✓" : "01"}</span>
            <div>
              <strong>Aturan PPh 21 dan BPJS</strong>
              <p>
                Sumber resmi, tanggal efektif, klasifikasi dan pembulatan
                lengkap; ditinjau orang kedua yang independen.
              </p>
              <small>
                {hasRules && !readiness.rulesReady
                  ? "Dataset ada, tetapi belum lulus pemeriksaan publikasi."
                  : "Dataset terbit yang memenuhi kontrak belum tersedia."}
              </small>
            </div>
          </li>
          <li className={readiness.pph21FixturesReady ? "is-complete" : undefined}>
            <span aria-hidden="true">
              {readiness.pph21FixturesReady ? "✓" : "02"}
            </span>
            <div>
              <strong>30 fixture pembanding PPh 21/TER</strong>
              <p>Setiap kasus perlu sumber, hasil harapan, dan verifikasi independen.</p>
              <small>{readiness.pph21FixtureCount}/30 fixture dengan bukti lengkap</small>
            </div>
          </li>
          <li className={readiness.bpjsFixturesReady ? "is-complete" : undefined}>
            <span aria-hidden="true">
              {readiness.bpjsFixturesReady ? "✓" : "03"}
            </span>
            <div>
              <strong>20 fixture pembanding BPJS</strong>
              <p>
                Kasus batas, tarif, klasifikasi program, pembagian porsi, dan
                pembulatan harus dicocokkan ke sumber.
              </p>
              <small>{readiness.bpjsFixtureCount}/20 fixture dengan bukti lengkap</small>
            </div>
          </li>
          <li className={readiness.productionReady ? "is-complete" : undefined}>
            <span aria-hidden="true">
              {readiness.productionReady ? "✓" : "04"}
            </span>
            <div>
              <strong>Validasi slip gaji nyata</strong>
              <p>
                Cocokkan hasil dengan slip gaji yang sudah dianonimkan sebelum
                hasil dipakai untuk produksi.
              </p>
              <small>
                {payrollReleaseData.payslipValidation.completed
                  ? "Validasi tercatat."
                  : "Belum divalidasi."}
              </small>
            </div>
          </li>
        </ul>
        <p class="payroll-gate-footnote">
          {readiness.canCalculate
            ? "Formulir dapat digunakan untuk validasi terbatas; hasil tetap bukan untuk produksi sampai validasi slip gaji selesai."
            : "Pratinjau struktur laporan tidak memuat angka gaji. Fitur cetak dan unduh laporan akan tersedia setelah aturan serta fixture lolos tinjauan."}
        </p>
      </section>
    </div>
  );
}

function ActivePayrollCalculator({
  productionReady,
}: {
  readonly productionReady: boolean;
}) {
  const taxRules = payrollReleaseData.taxRules!;
  const bpjsRules = payrollReleaseData.bpjsRules!;
  const [draft, setDraft] = useState(() =>
    createPayrollFormDraft(taxRules.data, bpjsRules.data),
  );
  const [result, setResult] = useState<{
    readonly calculation: NetSalaryCalculation;
    readonly draft: PayrollFormDraft;
  } | null>(null);
  const [error, setError] = useState("");

  const startMonth = Number(draft.employmentStartMonth);
  const currentMonth = Number(draft.taxMonth);
  const historyMonths =
    Number.isInteger(startMonth) &&
    Number.isInteger(currentMonth) &&
    startMonth >= 1 &&
    startMonth < currentMonth &&
    currentMonth <= 12
      ? Array.from(
          { length: currentMonth - startMonth },
          (_, index) => startMonth + index,
        )
      : [];

  const updateCurrentMonth = (next: MonthDraft) =>
    setDraft((previous) => ({ ...previous, currentMonth: next }));
  const updateHistoryMonth = (month: number, next: MonthDraft) =>
    setDraft((previous) => ({
      ...previous,
      previousMonths: { ...previous.previousMonths, [month]: next },
    }));

  function updatePeriod(patch: Partial<PayrollFormDraft>) {
    setDraft((previous) => {
      const next = { ...previous, ...patch };
      if (
        patch.taxYear !== undefined ||
        patch.taxMonth !== undefined
      ) {
        const month = String(next.taxMonth).padStart(2, "0");
        next.asOfDate = `${next.taxYear}-${month}-01`;
      }
      return next;
    });
  }

  function handleSubmit(event: TargetedSubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    try {
      const input = buildPayrollCalculationInput(draft, taxRules, bpjsRules);
      const calculation = calculateNetSalary(input);
      setResult({
        calculation,
        draft: JSON.parse(JSON.stringify(draft)) as PayrollFormDraft,
      });
    } catch (calculationError) {
      setError(
        calculationError instanceof Error
          ? calculationError.message
          : "Perhitungan tidak dapat dilakukan. Periksa kembali semua input.",
      );
    }
  }

  return (
    <div class="payroll-calculator">
      <div
        className={`payroll-pilot-notice${productionReady ? " is-production" : ""}`}
        role="status"
      >
        <strong>
          {productionReady
            ? "Validasi prasyarat produksi tercatat"
            : "Validasi terbatas · bukan untuk produksi"}
        </strong>
        <p>
          {productionReady
            ? "Periksa periode dan asumsi pada setiap laporan."
            : "Hasil hanya untuk validasi dengan aturan dan fixture yang sudah ditinjau. Slip gaji nyata yang dianonimkan belum selesai divalidasi."}
        </p>
      </div>

      <form class="payroll-input-form" onSubmit={handleSubmit}>
        <section class="payroll-form-section" aria-labelledby="payroll-period-title">
          <div class="payroll-form-section-heading">
            <span>01</span>
            <div>
              <h2 id="payroll-period-title">Periode dan status pegawai</h2>
              <p>Gunakan status pajak pada awal tahun pajak.</p>
            </div>
          </div>
          <div class="payroll-form-grid">
            <label class="payroll-field" for="payroll-tax-year">
              <span>Tahun pajak</span>
              <input
                id="payroll-tax-year"
                type="number"
                min="1900"
                max="9999"
                required
                value={draft.taxYear}
                onInput={(event) => updatePeriod({ taxYear: event.currentTarget.value })}
              />
            </label>
            <label class="payroll-field" for="payroll-tax-month">
              <span>Bulan gaji</span>
              <select
                id="payroll-tax-month"
                required
                value={draft.taxMonth}
                onChange={(event) => updatePeriod({ taxMonth: event.currentTarget.value })}
              >
                {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                  <option value={String(month)}>{monthName(month)}</option>
                ))}
              </select>
            </label>
            <label class="payroll-field" for="payroll-start-month">
              <span>Bulan mulai bekerja pada tahun ini</span>
              <select
                id="payroll-start-month"
                required
                value={draft.employmentStartMonth}
                onChange={(event) =>
                  updatePeriod({ employmentStartMonth: event.currentTarget.value })
                }
              >
                {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                  <option value={String(month)}>{monthName(month)}</option>
                ))}
              </select>
            </label>
            <label class="payroll-field" for="payroll-as-of-date">
              <span>Tanggal perhitungan</span>
              <input
                id="payroll-as-of-date"
                type="date"
                required
                value={draft.asOfDate}
                onInput={(event) => updatePeriod({ asOfDate: event.currentTarget.value })}
              />
            </label>
            <label class="payroll-field" for="payroll-tax-status">
              <span>Status PTKP awal tahun</span>
              <select
                id="payroll-tax-status"
                required
                value={draft.taxStatusAtYearStart}
                onChange={(event) =>
                  updatePeriod({ taxStatusAtYearStart: event.currentTarget.value })
                }
              >
                <option value="">Pilih status</option>
                {Object.keys(taxRules.data.terCategoryByTaxStatus).map((status) => (
                  <option value={status}>{status}</option>
                ))}
              </select>
            </label>
            <label class="payroll-field" for="payroll-tax-subject">
              <span>Kewajiban pajak dimulai sejak awal tahun?</span>
              <select
                id="payroll-tax-subject"
                required
                value={draft.taxSubjectAtYearStart}
                onChange={(event) =>
                  updatePeriod({
                    taxSubjectAtYearStart: event.currentTarget.value as
                      | "yes"
                      | "no"
                      | "",
                  })
                }
              >
                <option value="">Pilih jawaban</option>
                <option value="yes">Ya</option>
                <option value="no">Tidak / dimulai setelah awal tahun</option>
              </select>
            </label>
            <label class="payroll-field" for="payroll-other-employers">
              <span>Ada pemberi kerja lain pada tahun ini?</span>
              <select
                id="payroll-other-employers"
                required
                value={draft.hasOtherEmployersThisYear}
                onChange={(event) =>
                  updatePeriod({
                    hasOtherEmployersThisYear: event.currentTarget.value as
                      | "yes"
                      | "no"
                      | "",
                  })
                }
              >
                <option value="">Pilih jawaban</option>
                <option value="no">Tidak</option>
                <option value="yes">Ya</option>
              </select>
            </label>
            <label class="payroll-field" for="payroll-employment-end">
              <span>Pekerjaan berakhir pada bulan ini?</span>
              <select
                id="payroll-employment-end"
                required
                value={draft.employmentEndsHere}
                onChange={(event) =>
                  updatePeriod({
                    employmentEndsHere: event.currentTarget.value as
                      | "yes"
                      | "no"
                      | "",
                  })
                }
              >
                <option value="">Pilih jawaban</option>
                <option value="no">Tidak</option>
                <option value="yes">Ya</option>
              </select>
            </label>
            <label class="payroll-field" for="payroll-gross-up">
              <span>Penghasilan memakai gross-up pajak?</span>
              <select
                id="payroll-gross-up"
                required
                value={draft.includesGrossUp}
                onChange={(event) =>
                  updatePeriod({
                    includesGrossUp: event.currentTarget.value as
                      | "yes"
                      | "no"
                      | "",
                  })
                }
              >
                <option value="">Pilih jawaban</option>
                <option value="no">Tidak</option>
                <option value="yes">Ya</option>
              </select>
            </label>
          </div>
          <p class="payroll-field-hint">
            Perhitungan terbatas pada satu pemberi kerja. Riwayat sebelumnya
            wajib lengkap jika bekerja lebih dari satu bulan pada tahun ini.
            Kasus kewajiban pajak yang baru dimulai, berhenti bekerja,
            multi-pemberi kerja, dan gross-up ditolak sampai aturan rinci
            diverifikasi.
          </p>
        </section>

        <section class="payroll-form-section" aria-labelledby="payroll-compensation-title">
          <div class="payroll-form-section-heading">
            <span>02</span>
            <div>
              <h2 id="payroll-compensation-title">Penghasilan bulan ini</h2>
              <p>
                Bedakan nilai komponen, nilai tunai, bruto kena pajak, dan
                masing-masing dasar upah.
              </p>
            </div>
          </div>
          <MonthFields
            month={currentMonth}
            draft={draft.currentMonth}
            taxRules={taxRules.data}
            bpjsRules={bpjsRules.data}
            history={false}
            onChange={updateCurrentMonth}
          />
        </section>

        <section class="payroll-form-section" aria-labelledby="payroll-bpjs-title">
          <div class="payroll-form-section-heading">
            <span>03</span>
            <div>
              <h2 id="payroll-bpjs-title">Keikutsertaan BPJS</h2>
              <p>Pilih keadaan setiap program; tidak ada pilihan otomatis.</p>
            </div>
          </div>
          <div class="payroll-form-grid payroll-participation-grid">
            {BPJS_PROGRAM_CODES.map((program) => (
              <label class="payroll-field" for={`payroll-participation-${program}`}>
                <span>
                  <b>{program.toUpperCase()}</b> · {PROGRAM_NAMES[program]}
                </span>
                <select
                  id={`payroll-participation-${program}`}
                  required
                  value={draft.bpjsParticipation[program]}
                  onChange={(event) =>
                    updatePeriod({
                      bpjsParticipation: {
                        ...draft.bpjsParticipation,
                        [program]: event.currentTarget.value as
                          | "yes"
                          | "no"
                          | "",
                      },
                    })
                  }
                >
                  <option value="">Pilih</option>
                  <option value="yes">Ikut</option>
                  <option value="no">Tidak ikut</option>
                </select>
              </label>
            ))}
            {bpjsRules.data.programs.jkk.ratesByRiskClass !== null && (
              <label class="payroll-field" for="payroll-risk-class">
                <span>Kelas risiko JKK</span>
                <select
                  id="payroll-risk-class"
                  value={draft.bpjsRiskClass}
                  onChange={(event) =>
                    updatePeriod({ bpjsRiskClass: event.currentTarget.value })
                  }
                >
                  <option value="">Pilih jika JKK diikuti</option>
                  {Object.keys(bpjsRules.data.programs.jkk.ratesByRiskClass).map(
                    (riskClass) => (
                      <option value={riskClass}>{riskClass}</option>
                    ),
                  )}
                </select>
              </label>
            )}
            <label class="payroll-field" for="payroll-jkn-dependents">
              <span>Tanggungan JKN tambahan</span>
              <input
                id="payroll-jkn-dependents"
                type="number"
                min="0"
                step="1"
                required
                value={draft.jknAdditionalDependents}
                onInput={(event) =>
                  updatePeriod({
                    jknAdditionalDependents: event.currentTarget.value,
                  })
                }
              />
            </label>
          </div>
        </section>

        {historyMonths.length > 0 && (
          <section class="payroll-form-section" aria-labelledby="payroll-history-title">
            <div class="payroll-form-section-heading">
              <span>04</span>
              <div>
                <h2 id="payroll-history-title">Riwayat gaji tahun ini</h2>
                <p>
                  Catat setiap bulan kerja sebelumnya dan PPh 21 yang benar-benar
                  dipotong. Bulan kosong tidak dianggap nol.
                </p>
              </div>
            </div>
            <div class="payroll-history-list">
              {historyMonths.map((month) => {
                const historyDraft = getHistoryMonthDraft(
                  draft,
                  month,
                  taxRules.data,
                  bpjsRules.data,
                );
                return (
                  <details class="payroll-history-month">
                    <summary>
                      <span>{monthName(month)} {draft.taxYear}</span>
                      <small>Riwayat wajib</small>
                    </summary>
                    <MonthFields
                      month={month}
                      draft={historyDraft}
                      taxRules={taxRules.data}
                      bpjsRules={bpjsRules.data}
                      history
                      onChange={(next) => updateHistoryMonth(month, next)}
                    />
                  </details>
                );
              })}
            </div>
          </section>
        )}

        <button class="payroll-calculate-button" type="submit">
          Hitung estimasi gaji bersih <span aria-hidden="true">→</span>
        </button>
        <p class="payroll-local-note">
          Semua angka dihitung di perangkat ini dan tidak dikirim ke server.
        </p>
        {error && (
          <div class="payroll-calculation-error" role="alert">
            <strong>Perhitungan belum berhasil</strong>
            <p>{error}</p>
          </div>
        )}
      </form>

      {result && (
        <section
          id="payroll-report"
          class="payroll-result-report"
          aria-labelledby="payroll-result-title"
        >
          <header class="payroll-result-header">
            <div>
              <span class="payroll-report-kicker">LAPORAN PERHITUNGAN</span>
              <h2 id="payroll-result-title">
                Gaji bersih · {monthName(result.calculation.period.taxMonth)}{" "}
                {result.calculation.period.taxYear}
              </h2>
              <p>
                Tanggal hitung {result.draft.asOfDate} · metode{" "}
                {result.calculation.method.version}
              </p>
            </div>
            <span class="payroll-report-label">
              {productionReady ? "Produksi" : "Belum untuk produksi"}
            </span>
          </header>
          <dl class="payroll-result-summary">
            <div>
              <dt>Gaji tunai</dt>
              <dd>{rupiah(result.calculation.gross.cashPayableRupiah)}</dd>
            </div>
            <div>
              <dt>Bruto kena PPh 21</dt>
              <dd>{rupiah(result.calculation.gross.taxablePph21Rupiah)}</dd>
            </div>
            <div>
              <dt>PPh 21 bulan ini</dt>
              <dd>{rupiah(result.calculation.tax.currentWithholdingRupiah)}</dd>
            </div>
            <div>
              <dt>Iuran BPJS pegawai</dt>
              <dd>{rupiah(result.calculation.bpjs.employeeTotalRupiah)}</dd>
            </div>
            <div>
              <dt>Potongan pegawai lain</dt>
              <dd>{rupiah(result.calculation.otherEmployeeDeductionsRupiah)}</dd>
            </div>
            <div class="payroll-result-total">
              <dt>Gaji bersih</dt>
              <dd>{rupiah(result.calculation.netPayRupiah)}</dd>
            </div>
          </dl>
          <div class="payroll-result-details">
            <h3>Rincian pajak</h3>
            <dl>
              <div>
                <dt>Kategori TER</dt>
                <dd>{result.calculation.tax.category}</dd>
              </div>
              <div>
                <dt>Metode masa pajak</dt>
                <dd>
                  {result.calculation.tax.mode === "ter-monthly"
                    ? "TER bulanan"
                    : "Rekonsiliasi masa pajak terakhir"}
                </dd>
              </div>
              {result.calculation.tax.rateBasisPoints !== null && (
                <div>
                  <dt>Tarif TER terpilih</dt>
                  <dd>{formatPercentage(result.calculation.tax.rateBasisPoints)}%</dd>
                </div>
              )}
              {result.calculation.tax.priorWithholdingRupiah > 0n && (
                <div>
                  <dt>PPh 21 dipotong sebelumnya</dt>
                  <dd>{rupiah(result.calculation.tax.priorWithholdingRupiah)}</dd>
                </div>
              )}
              {result.calculation.tax.taxableIncomeRupiah !== null && (
                <div>
                  <dt>PKP setelah pembulatan</dt>
                  <dd>{rupiah(result.calculation.tax.taxableIncomeRupiah)}</dd>
                </div>
              )}
            </dl>
          </div>
          <div class="payroll-programs-heading">
            <h3>Rincian enam program BPJS</h3>
            <span>
              Porsi pemberi kerja dan pemerintah tidak mengurangi gaji bersih.
            </span>
          </div>
          <div class="payroll-result-table-wrap">
            <table class="payroll-result-table">
              <thead>
                <tr>
                  <th>Program</th>
                  <th>Status</th>
                  <th>Dasar iuran</th>
                  <th>Porsi pegawai</th>
                  <th>Porsi pemberi kerja</th>
                  <th>Porsi pemerintah</th>
                </tr>
              </thead>
              <tbody>
                {result.calculation.bpjs.programs.map((line) => (
                  <tr>
                    <th scope="row">
                      <span>{line.program.toUpperCase()}</span>
                      {line.label}
                    </th>
                    <td>{line.participation ? "Ikut" : "Tidak ikut"}</td>
                    <td>{rupiah(line.contributionBaseRupiah)}</td>
                    <td>{rupiah(line.employeeRupiah)}</td>
                    <td>{rupiah(line.employerRupiah)}</td>
                    <td>{rupiah(line.governmentRupiah)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.calculation.warnings.length > 0 && (
            <div class="payroll-report-notes">
              <h3>Catatan dan batasan</h3>
              <ul>
                {result.calculation.warnings.map((warning) => <li>{warning}</li>)}
              </ul>
            </div>
          )}
          <p class="payroll-report-provenance">
            Aturan PPh 21: {result.calculation.method.taxRule.version} · aturan
            BPJS: {result.calculation.method.bpjsRule.version} · tanggal berlaku
            harus dicocokkan dengan periode gaji.
          </p>
          <div class="payroll-report-actions no-print">
            <button
              type="button"
              onClick={() =>
                downloadReport(
                  result.calculation,
                  result.draft,
                  productionReady,
                )
              }
            >
              Unduh laporan CSV
            </button>
            <button type="button" onClick={() => window.print()}>
              Cetak / simpan PDF
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export default function PayrollCalculator() {
  const readiness = evaluatePayrollReadiness(payrollReleaseData);
  if (
    !readiness.canCalculate ||
    !payrollReleaseData.taxRules ||
    !payrollReleaseData.bpjsRules
  ) {
    return <ReadinessPanel />;
  }
  return <ActivePayrollCalculator productionReady={readiness.productionReady} />;
}
