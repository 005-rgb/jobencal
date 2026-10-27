import {
  calculateKpr,
  type KprCalculation,
  type KprModel,
} from "./kpr.js";

const MAX_RUPIAH = 999_999_999_999_999_999n;
const METHOD_KEY = "vehicle.installment-simulation";
const METHOD_VERSION = "1.0.0";

export type VehicleCostKey = "administration" | "insurance" | "other";

export interface VehicleCostInput {
  readonly amountRupiah: bigint;
  readonly payment: "upfront" | "financed";
}

export interface VehicleInstallmentInput {
  readonly vehiclePriceRupiah: bigint;
  readonly downPaymentRupiah: bigint;
  readonly termMonths: number;
  readonly model: KprModel;
  /** User-entered nominal annual percentage in basis points (e.g. 1,200 = 12%). */
  readonly annualRateBasisPoints: bigint;
  readonly costs?: Partial<Record<VehicleCostKey, VehicleCostInput>>;
}

export interface VehicleInstallmentCalculation {
  readonly method: {
    readonly key: typeof METHOD_KEY;
    readonly version: typeof METHOD_VERSION;
    readonly model: KprModel;
    readonly annualRateBasis: "nominal-per-year-divided-by-12";
    readonly paymentTiming: "monthly-in-arrears";
    readonly monthlyInterestRounding: "Rupiah utuh, half-away-from-zero";
  };
  readonly input: VehicleInstallmentInput;
  readonly financedPrincipalRupiah: bigint;
  readonly upfrontCostsRupiah: bigint;
  readonly financedCostsRupiah: bigint;
  readonly schedule: KprCalculation["schedule"];
  readonly totals: {
    readonly vehiclePriceRupiah: bigint;
    readonly downPaymentRupiah: bigint;
    readonly principalRupiah: bigint;
    readonly interestRupiah: bigint;
    readonly installmentsRupiah: bigint;
    readonly upfrontCostsRupiah: bigint;
    readonly financedCostsRupiah: bigint;
    readonly cashAtSigningRupiah: bigint;
    readonly totalCashOutflowRupiah: bigint;
    readonly firstInstallmentRupiah: bigint;
    readonly lastInstallmentRupiah: bigint;
    readonly actualTermMonths: number;
  };
  readonly assumptions: readonly string[];
  readonly warnings: readonly string[];
}

export class VehicleInstallmentCalculationError extends Error {
  constructor(
    readonly code:
      | "invalid_vehicle_price"
      | "invalid_down_payment"
      | "invalid_cost"
      | "invalid_cost_payment"
      | "invalid_financed_principal"
      | "calculation_overflow"
      | "invalid_tenor"
      | "invalid_rate"
      | "invalid_model",
    message: string,
  ) {
    super(message);
    this.name = "VehicleInstallmentCalculationError";
  }
}

function checkedRupiah(value: bigint, label: string): bigint {
  if (typeof value !== "bigint" || value < 0n) {
    throw new VehicleInstallmentCalculationError(
      "invalid_cost",
      `${label} harus berupa Rupiah utuh yang tidak negatif.`,
    );
  }
  if (value > MAX_RUPIAH) {
    throw new VehicleInstallmentCalculationError(
      "calculation_overflow",
      `${label} melampaui batas Rupiah 18 digit.`,
    );
  }
  return value;
}

/**
 * Pure, local-only vehicle financing simulation. Costs are either paid upfront
 * or explicitly added to financed principal; user-entered rates are not quotes.
 */
export function calculateVehicleInstallment(
  input: VehicleInstallmentInput,
): VehicleInstallmentCalculation {
  if (
    typeof input.vehiclePriceRupiah !== "bigint" ||
    input.vehiclePriceRupiah <= 0n ||
    input.vehiclePriceRupiah > MAX_RUPIAH
  ) {
    throw new VehicleInstallmentCalculationError(
      "invalid_vehicle_price",
      "Harga kendaraan harus lebih besar dari nol dan maksimal 18 digit Rupiah.",
    );
  }
  checkedRupiah(input.downPaymentRupiah, "Uang muka");
  if (input.downPaymentRupiah > input.vehiclePriceRupiah) {
    throw new VehicleInstallmentCalculationError(
      "invalid_down_payment",
      "Uang muka tidak boleh melebihi harga kendaraan.",
    );
  }

  const costs = input.costs ?? {};
  let upfrontCostsRupiah = 0n;
  let financedCostsRupiah = 0n;
  for (const [key, cost] of Object.entries(costs)) {
    if (!cost) continue;
    checkedRupiah(cost.amountRupiah, `Biaya ${key}`);
    if (cost.payment === "upfront") {
      upfrontCostsRupiah += cost.amountRupiah;
    } else if (cost.payment === "financed") {
      financedCostsRupiah += cost.amountRupiah;
    } else {
      throw new VehicleInstallmentCalculationError(
        "invalid_cost_payment",
        `Cara pembayaran biaya ${key} tidak dikenal.`,
      );
    }
  }
  checkedRupiah(upfrontCostsRupiah, "Total biaya awal");
  checkedRupiah(financedCostsRupiah, "Total biaya yang dibiayai");

  const financedPrincipalRupiah =
    input.vehiclePriceRupiah - input.downPaymentRupiah + financedCostsRupiah;
  if (
    financedPrincipalRupiah <= 0n ||
    financedPrincipalRupiah > MAX_RUPIAH
  ) {
    throw new VehicleInstallmentCalculationError(
      "invalid_financed_principal",
      "Pokok pembiayaan harus lebih besar dari nol dan tidak melebihi batas Rupiah.",
    );
  }

  const loanCosts = {
    administrationRupiah:
      costs.administration?.payment === "upfront"
        ? costs.administration.amountRupiah
        : 0n,
    insuranceRupiah:
      costs.insurance?.payment === "upfront"
        ? costs.insurance.amountRupiah
        : 0n,
    taxAndNotaryRupiah:
      costs.other?.payment === "upfront" ? costs.other.amountRupiah : 0n,
  };
  let loan: KprCalculation;
  try {
    loan = calculateKpr({
      principalRupiah: financedPrincipalRupiah,
      termMonths: input.termMonths,
      model: input.model,
      annualRateBasisPoints: input.annualRateBasisPoints,
      costs: loanCosts,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "KprCalculationError") {
      const code = (
        error as Error & { readonly code?: string }
      ).code;
      if (code === "invalid_tenor" || code === "invalid_rate" || code === "invalid_model") {
        throw new VehicleInstallmentCalculationError(code, error.message);
      }
      throw new VehicleInstallmentCalculationError(
        "calculation_overflow",
        error.message,
      );
    }
    throw error;
  }

  const cashAtSigningRupiah =
    input.downPaymentRupiah + upfrontCostsRupiah;
  const totalCashOutflowRupiah =
    cashAtSigningRupiah + loan.totals.installmentsRupiah;
  checkedRupiah(cashAtSigningRupiah, "Total pembayaran saat penandatanganan");
  checkedRupiah(totalCashOutflowRupiah, "Total pengeluaran");

  return {
    method: {
      key: METHOD_KEY,
      version: METHOD_VERSION,
      model: input.model,
      annualRateBasis: "nominal-per-year-divided-by-12",
      paymentTiming: "monthly-in-arrears",
      monthlyInterestRounding: "Rupiah utuh, half-away-from-zero",
    },
    input,
    financedPrincipalRupiah,
    upfrontCostsRupiah,
    financedCostsRupiah,
    schedule: loan.schedule,
    totals: {
      vehiclePriceRupiah: input.vehiclePriceRupiah,
      downPaymentRupiah: input.downPaymentRupiah,
      principalRupiah: financedPrincipalRupiah,
      interestRupiah: loan.totals.interestRupiah,
      installmentsRupiah: loan.totals.installmentsRupiah,
      upfrontCostsRupiah,
      financedCostsRupiah,
      cashAtSigningRupiah,
      totalCashOutflowRupiah,
      firstInstallmentRupiah: loan.totals.firstInstallmentRupiah,
      lastInstallmentRupiah: loan.totals.lastInstallmentRupiah,
      actualTermMonths: loan.totals.actualTermMonths,
    },
    assumptions: [
      "Mode generik menggunakan asumsi pengguna; hasil bukan tarif pasar, kutipan, persetujuan kredit, atau penawaran dari lembaga pembiayaan.",
      "Bunga tahunan nominal dibagi 12; bunga bulan berjalan dihitung dari pokok awal periode dan dibulatkan ke Rupiah terdekat, setengah menjauh dari nol.",
      "Pembayaran dilakukan pada akhir bulan. Biaya hanya dibiayai jika mode 'masuk pembiayaan' dipilih; biaya lainnya dibayar saat penandatanganan.",
      "Tidak ada biaya, asuransi, pajak, penalti, nilai residu, atau aturan produk yang diasumsikan selain input yang terlihat.",
      input.model === "flat"
        ? "Metode flat memakai pokok pembiayaan awal sebagai dasar bunga setiap bulan."
        : input.model === "effective"
          ? "Metode efektif membagi pokok tersisa secara merata selama tenor tersisa; bunga dihitung dari saldo awal setiap bulan."
          : "Metode anuitas memakai angsuran tetap setelah pembulatan Rupiah; angsuran terakhir disesuaikan agar saldo pokok tepat nol.",
    ],
    warnings: [
      "Verifikasi metode, biaya, bunga, dan perlindungan/asuransi pada dokumen produk pemberi pembiayaan yang berlaku sebelum mengambil keputusan.",
      "Simulasi tidak memasukkan biaya yang tidak Anda masukkan dan tidak menjamin persetujuan atau nominal tagihan aktual.",
    ],
  };
}
