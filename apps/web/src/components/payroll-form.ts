import {
  BPJS_PROGRAM_CODES,
  type BpjsProgramCode,
  type BpjsRuleData,
  type CalculateNetSalaryInput,
  type PayrollHistoryMonthInput,
  type PayrollMonthInput,
  type PayrollTaxRuleData,
  type VersionedPayrollRules,
} from "@jobenapp/engine";
import { parseRupiahInput } from "@jobenapp/shared";

export type ParticipationChoice = "" | "yes" | "no";

export interface CompensationDraft {
  readonly id: string;
  readonly description: string;
  readonly amountRupiah: string;
  readonly cashPayableRupiah: string;
  readonly taxablePph21Rupiah: string;
  readonly bpjsWageBasesRupiah: Readonly<Record<string, string>>;
}

export interface MonthDraft {
  readonly compensation: readonly CompensationDraft[];
  readonly pph21WithheldRupiah: string;
  readonly employeeDeductions: Readonly<Record<string, string>>;
  readonly otherEmployeeDeductionRupiah: string;
}

export interface PayrollFormDraft {
  readonly taxYear: string;
  readonly taxMonth: string;
  readonly employmentStartMonth: string;
  readonly employmentEndsHere: ParticipationChoice;
  readonly taxSubjectAtYearStart: ParticipationChoice;
  readonly hasOtherEmployersThisYear: ParticipationChoice;
  readonly includesGrossUp: ParticipationChoice;
  readonly asOfDate: string;
  readonly taxStatusAtYearStart: string;
  readonly bpjsRiskClass: string;
  readonly bpjsParticipation: Readonly<Record<BpjsProgramCode, ParticipationChoice>>;
  readonly jknAdditionalDependents: string;
  readonly currentMonth: MonthDraft;
  readonly previousMonths: Readonly<Record<number, MonthDraft>>;
}

const OTHER_DEDUCTION_CODE = "other_employee_deduction";

export function getWageBaseGroups(
  rules: BpjsRuleData,
): readonly { readonly key: string; readonly programs: readonly BpjsProgramCode[] }[] {
  const grouped = new Map<string, BpjsProgramCode[]>();
  for (const program of BPJS_PROGRAM_CODES) {
    const key = rules.programs[program].wageBaseKey;
    const programs = grouped.get(key) ?? [];
    programs.push(program);
    grouped.set(key, programs);
  }
  return [...grouped].map(([key, programs]) => ({ key, programs }));
}

function emptyCompensation(
  wageBaseKeys: readonly string[],
  index: number,
): CompensationDraft {
  return {
    id: `komponen-${index + 1}`,
    description: index === 0 ? "Gaji pokok" : "",
    amountRupiah: "",
    cashPayableRupiah: "",
    taxablePph21Rupiah: "",
    bpjsWageBasesRupiah: Object.fromEntries(
      wageBaseKeys.map((key) => [key, ""]),
    ),
  };
}

function newMonthDraft(
  wageBaseKeys: readonly string[],
  deductionCodes: readonly string[],
): MonthDraft {
  return {
    compensation: [emptyCompensation(wageBaseKeys, 0)],
    pph21WithheldRupiah: "",
    employeeDeductions: Object.fromEntries(
      deductionCodes.map((code) => [code, "0"]),
    ),
    otherEmployeeDeductionRupiah: "0",
  };
}

export function createPayrollFormDraft(
  taxRules: PayrollTaxRuleData,
  bpjsRules: BpjsRuleData,
  initialDate = new Date(),
): PayrollFormDraft {
  const year = initialDate.getFullYear();
  const month = initialDate.getMonth() + 1;
  const yearText = String(year);
  const monthText = String(month).padStart(2, "0");
  const wageBaseKeys = getWageBaseGroups(bpjsRules).map((group) => group.key);
  const deductionCodes = taxRules.annualTaxDeductionCodes.filter(
    (code) => code !== OTHER_DEDUCTION_CODE,
  );

  return {
    taxYear: yearText,
    taxMonth: String(month),
    employmentStartMonth: String(month),
    employmentEndsHere: "",
    taxSubjectAtYearStart: "",
    hasOtherEmployersThisYear: "",
    includesGrossUp: "",
    asOfDate: `${yearText}-${monthText}-01`,
    taxStatusAtYearStart:
      Object.keys(taxRules.terCategoryByTaxStatus)[0] ?? "",
    bpjsRiskClass: "",
    bpjsParticipation: {
      jkn: "",
      jht: "",
      jp: "",
      jkk: "",
      jkm: "",
      jkp: "",
    },
    jknAdditionalDependents: "0",
    currentMonth: newMonthDraft(wageBaseKeys, deductionCodes),
    previousMonths: {},
  };
}

function parseRupiah(value: string, label: string): bigint {
  const amount = parseRupiahInput(value);
  if (amount === null) {
    throw new Error(`${label} wajib diisi. Masukkan 0 jika tidak ada.`);
  }
  return amount;
}

function parseWholeNumber(value: string, label: string): number {
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    throw new Error(`${label} harus berupa bilangan bulat non-negatif.`);
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number)) {
    throw new Error(`${label} berada di luar batas yang didukung.`);
  }
  return number;
}

function toPayrollMonth(
  month: number,
  draft: MonthDraft,
  deductionCodes: readonly string[],
  includePphWithheld: boolean,
): PayrollMonthInput | PayrollHistoryMonthInput {
  if (!draft.compensation.length) {
    throw new Error(`Periode ${month} harus memiliki minimal satu komponen penghasilan.`);
  }
  const compensation = draft.compensation.map((item) => {
    if (!item.description.trim()) {
      throw new Error(`Nama komponen pada periode ${month} wajib diisi.`);
    }
    return {
      key: item.id,
      amountRupiah: parseRupiah(
        item.amountRupiah,
        `${item.description} · nilai komponen periode ${month}`,
      ),
      cashPayableRupiah: parseRupiah(
        item.cashPayableRupiah,
        `${item.description} · nilai tunai periode ${month}`,
      ),
      taxablePph21Rupiah: parseRupiah(
        item.taxablePph21Rupiah,
        `${item.description} · bruto PPh 21 periode ${month}`,
      ),
      bpjsWageBasesRupiah: Object.fromEntries(
        Object.entries(item.bpjsWageBasesRupiah).map(([key, value]) => [
          key,
          parseRupiah(value, `${item.description} · dasar upah ${key} periode ${month}`),
        ]),
      ),
    };
  });

  const employeeDeductions = deductionCodes.map((code) => ({
    code,
    amountRupiah: parseRupiah(
      draft.employeeDeductions[code] ?? "",
      `Potongan ${code} periode ${month}`,
    ),
  }));
  employeeDeductions.push({
    code: OTHER_DEDUCTION_CODE,
    amountRupiah: parseRupiah(
      draft.otherEmployeeDeductionRupiah,
      `Potongan pegawai lain periode ${month}`,
    ),
  });

  const record: PayrollMonthInput = {
    month,
    compensation,
    employeeDeductions,
  };
  if (!includePphWithheld) return record;
  return {
    ...record,
    pph21WithheldRupiah: parseRupiah(
      draft.pph21WithheldRupiah,
      `PPh 21 yang benar-benar dipotong periode ${month}`,
    ),
  };
}

export function buildPayrollCalculationInput(
  draft: PayrollFormDraft,
  taxRules: VersionedPayrollRules<PayrollTaxRuleData>,
  bpjsRules: VersionedPayrollRules<BpjsRuleData>,
): CalculateNetSalaryInput {
  const taxYear = parseWholeNumber(draft.taxYear, "Tahun pajak");
  const taxMonth = parseWholeNumber(draft.taxMonth, "Bulan pajak");
  const employmentStartMonth = parseWholeNumber(
    draft.employmentStartMonth,
    "Bulan mulai bekerja",
  );
  const jknAdditionalDependents = parseWholeNumber(
    draft.jknAdditionalDependents,
    "Jumlah tanggungan JKN",
  );
  const expectedAsOfDate = `${taxYear}-${String(taxMonth).padStart(2, "0")}-`;
  if (!draft.asOfDate.startsWith(expectedAsOfDate)) {
    throw new Error("Tanggal perhitungan harus berada pada bulan penggajian yang dipilih.");
  }
  if (draft.taxSubjectAtYearStart !== "yes") {
    throw new Error(
      draft.taxSubjectAtYearStart === "no"
        ? "Kasus saat kewajiban pajak dimulai setelah awal tahun belum didukung; perhitungan ditolak."
        : "Nyatakan apakah kewajiban subjek pajak sudah dimulai sejak awal tahun.",
    );
  }
  if (draft.hasOtherEmployersThisYear !== "no") {
    throw new Error(
      draft.hasOtherEmployersThisYear === "yes"
        ? "Penghasilan dari beberapa pemberi kerja belum digabungkan; perhitungan ditolak."
        : "Nyatakan apakah ada pemberi kerja lain pada tahun pajak ini.",
    );
  }
  if (draft.employmentEndsHere !== "no") {
    throw new Error(
      draft.employmentEndsHere === "yes"
        ? "Variasi pajak saat pekerjaan berakhir belum diverifikasi; perhitungan ditolak."
        : "Nyatakan apakah pekerjaan berakhir pada bulan ini.",
    );
  }
  if (draft.includesGrossUp !== "no") {
    throw new Error(
      draft.includesGrossUp === "yes"
        ? "Perhitungan gross-up belum didukung; perhitungan ditolak."
        : "Nyatakan apakah penghasilan menggunakan gross-up pajak.",
    );
  }

  const participation = Object.fromEntries(
    BPJS_PROGRAM_CODES.map((program) => {
      const choice = draft.bpjsParticipation[program];
      if (choice !== "yes" && choice !== "no") {
        throw new Error(`Keikutsertaan BPJS ${program.toUpperCase()} wajib dipilih.`);
      }
      return [program, choice === "yes"];
    }),
  ) as CalculateNetSalaryInput["bpjsParticipation"];

  const deductionCodes = taxRules.data.annualTaxDeductionCodes.filter(
    (code) => code !== OTHER_DEDUCTION_CODE,
  );
  const firstPreviousMonth = employmentStartMonth;
  const previousMonths = Array.from(
    { length: Math.max(0, taxMonth - firstPreviousMonth) },
    (_, index) => {
      const month = firstPreviousMonth + index;
      const monthDraft = draft.previousMonths[month];
      if (!monthDraft) {
        throw new Error(`Riwayat bulan ${month} belum diisi.`);
      }
      const record = toPayrollMonth(month, monthDraft, deductionCodes, true);
      if (!("pph21WithheldRupiah" in record)) {
        throw new Error(`Riwayat PPh 21 bulan ${month} belum tersedia.`);
      }
      return record;
    },
  );

  const currentMonth = toPayrollMonth(
    taxMonth,
    draft.currentMonth,
    deductionCodes,
    false,
  );

  return {
    taxYear,
    taxMonth,
    employmentStartMonth,
    employmentEndMonth: null,
    asOfDate: draft.asOfDate,
    taxStatusAtYearStart: draft.taxStatusAtYearStart,
    bpjsRiskClass: draft.bpjsRiskClass || null,
    bpjsParticipation: participation,
    jknAdditionalDependents,
    previousMonths,
    currentMonth,
    taxRules,
    bpjsRules,
  };
}

export function monthName(month: number): string {
  return new Intl.DateTimeFormat("id-ID", { month: "long" }).format(
    new Date(2026, month - 1, 1),
  );
}

export function getHistoryMonthDraft(
  draft: PayrollFormDraft,
  month: number,
  taxRules: PayrollTaxRuleData,
  bpjsRules: BpjsRuleData,
): MonthDraft {
  return (
    draft.previousMonths[month] ??
    newMonthDraft(
      getWageBaseGroups(bpjsRules).map((group) => group.key),
      taxRules.annualTaxDeductionCodes.filter(
        (code) => code !== OTHER_DEDUCTION_CODE,
      ),
    )
  );
}
