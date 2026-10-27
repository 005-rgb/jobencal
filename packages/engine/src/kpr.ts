import { roundRatio } from "./money.js";

const MONTHS_PER_YEAR = 12;
const MONTHLY_RATE_DENOMINATOR = 120_000n;
const MAX_RUPIAH = 999_999_999_999_999_999n;
const METHOD_KEY = "mortgage.kpr-simulation";
const METHOD_VERSION = "1.1.0";

export type KprModel = "annuity" | "flat" | "effective";

export class KprCalculationError extends Error {
  constructor(
    readonly code:
      | "invalid_principal"
      | "invalid_tenor"
      | "invalid_rate"
      | "invalid_model"
      | "invalid_floating_period"
      | "invalid_cost"
      | "invalid_early_repayment"
      | "calculation_overflow",
    message: string,
  ) {
    super(message);
    this.name = "KprCalculationError";
  }
}

export interface KprCalculationInput {
  readonly principalRupiah: bigint;
  readonly termMonths: number;
  readonly model: KprModel;
  /** Annual nominal percentage in basis points; 650 means 6.50% p.a. */
  readonly annualRateBasisPoints: bigint;
  readonly floatingRate?: {
    readonly fixedMonths: number;
    readonly annualRateBasisPoints: bigint;
  };
  readonly costs?: {
    readonly provisionRupiah?: bigint;
    readonly administrationRupiah?: bigint;
    readonly insuranceRupiah?: bigint;
    readonly taxAndNotaryRupiah?: bigint;
  };
  readonly earlyRepayment?: {
    /** A lump-sum principal repayment is applied after this month's installment. */
    readonly month: number;
    readonly amountRupiah: bigint;
  };
}

export interface KprInstallment {
  readonly month: number;
  readonly annualRateBasisPoints: bigint;
  readonly openingBalanceRupiah: bigint;
  readonly installmentRupiah: bigint;
  readonly interestRupiah: bigint;
  readonly principalRupiah: bigint;
  readonly extraPrincipalRupiah: bigint;
  readonly closingBalanceRupiah: bigint;
  readonly isFinalAdjustment: boolean;
}

export interface KprCalculation {
  readonly method: {
    readonly key: typeof METHOD_KEY;
    readonly version: typeof METHOD_VERSION;
    readonly model: KprModel;
    readonly rateConversion: "nominal-annual-divided-by-12";
    readonly paymentTiming: "monthly-in-arrears";
    readonly monthlyInterestPrecision: "Rupiah utuh, half-away-from-zero";
  };
  readonly input: KprCalculationInput;
  readonly schedule: readonly KprInstallment[];
  readonly totals: {
    readonly principalRupiah: bigint;
    readonly interestRupiah: bigint;
    readonly repaidPrincipalRupiah: bigint;
    readonly installmentsRupiah: bigint;
    readonly extraRepaymentsRupiah: bigint;
    readonly feesRupiah: bigint;
    readonly totalCashOutflowRupiah: bigint;
    readonly firstInstallmentRupiah: bigint;
    readonly lastInstallmentRupiah: bigint;
    readonly actualTermMonths: number;
  };
  readonly costs: {
    readonly provisionRupiah: bigint;
    readonly administrationRupiah: bigint;
    readonly insuranceRupiah: bigint;
    readonly taxAndNotaryRupiah: bigint;
  };
  readonly assumptions: readonly string[];
  readonly warnings: readonly string[];
}

function assertSafeRupiah(value: bigint, label: string): void {
  if (typeof value !== "bigint" || value < 0n) {
    throw new KprCalculationError(
      "invalid_cost",
      `${label} harus berupa Rupiah utuh yang tidak negatif.`,
    );
  }
  if (value > MAX_RUPIAH) {
    throw new KprCalculationError(
      "calculation_overflow",
      `${label} melampaui batas Rupiah yang dapat ditampilkan.`,
    );
  }
}

function assertRate(rate: bigint, label: string): void {
  if (typeof rate !== "bigint" || rate < 0n || rate > 10_000n) {
    throw new KprCalculationError(
      "invalid_rate",
      `${label} harus berada di antara 0% dan 100% per tahun.`,
    );
  }
}

function checkedSum(values: readonly bigint[], label: string): bigint {
  const total = values.reduce((sum, value) => sum + value, 0n);
  assertSafeRupiah(total, label);
  return total;
}

function annuityPayment(
  balance: bigint,
  annualRateBasisPoints: bigint,
  remainingMonths: number,
): bigint {
  if (annualRateBasisPoints === 0n) {
    return roundRatio(balance, BigInt(remainingMonths), "half-away-from-zero");
  }

  const periodBase = MONTHLY_RATE_DENOMINATOR + annualRateBasisPoints;
  const periodBasePower = periodBase ** BigInt(remainingMonths);
  const rateDenominatorPower =
    MONTHLY_RATE_DENOMINATOR ** BigInt(remainingMonths);
  const numerator = balance * annualRateBasisPoints * periodBasePower;
  const denominator =
    MONTHLY_RATE_DENOMINATOR * (periodBasePower - rateDenominatorPower);
  return roundRatio(numerator, denominator, "half-away-from-zero");
}

function modelName(model: KprModel): string {
  if (model === "annuity") return "Anuitas";
  if (model === "flat") return "Flat";
  if (model === "effective") return "Efektif";
  throw new KprCalculationError("invalid_model", "Model amortisasi tidak dikenal.");
}

function validateInput(input: KprCalculationInput): void {
  if (
    typeof input.principalRupiah !== "bigint" ||
    input.principalRupiah <= 0n ||
    input.principalRupiah > MAX_RUPIAH
  ) {
    throw new KprCalculationError(
      "invalid_principal",
      "Pokok pinjaman harus lebih besar dari nol dan tidak melebihi batas Rupiah.",
    );
  }
  if (
    !Number.isInteger(input.termMonths) ||
    input.termMonths < 1 ||
    input.termMonths > 360
  ) {
    throw new KprCalculationError(
      "invalid_tenor",
      "Tenor harus berupa bilangan bulat antara 1 dan 360 bulan.",
    );
  }
  modelName(input.model);
  assertRate(input.annualRateBasisPoints, "Suku bunga");

  if (input.floatingRate) {
    if (
      !Number.isInteger(input.floatingRate.fixedMonths) ||
      input.floatingRate.fixedMonths < 1 ||
      input.floatingRate.fixedMonths >= input.termMonths
    ) {
      throw new KprCalculationError(
        "invalid_floating_period",
        "Periode bunga tetap harus minimal 1 bulan dan lebih pendek dari tenor.",
      );
    }
    assertRate(
      input.floatingRate.annualRateBasisPoints,
      "Suku bunga mengambang",
    );
  }

  for (const [label, amount] of Object.entries(input.costs ?? {})) {
    assertSafeRupiah(amount ?? 0n, `Biaya ${label}`);
  }

  if (input.earlyRepayment) {
    if (
      !Number.isInteger(input.earlyRepayment.month) ||
      input.earlyRepayment.month < 1 ||
      input.earlyRepayment.month >= input.termMonths
    ) {
      throw new KprCalculationError(
        "invalid_early_repayment",
        "Bulan pelunasan dipercepat harus sebelum angsuran terakhir.",
      );
    }
    assertSafeRupiah(input.earlyRepayment.amountRupiah, "Pelunasan dipercepat");
    if (input.earlyRepayment.amountRupiah === 0n) {
      throw new KprCalculationError(
        "invalid_early_repayment",
        "Nominal pelunasan dipercepat harus lebih besar dari nol.",
      );
    }
  }
}

/**
 * Local-only mortgage simulation. User-entered rates and fees are assumptions,
 * not bank quotations. All money arithmetic and monthly rounding use BigInt.
 */
export function calculateKpr(input: KprCalculationInput): KprCalculation {
  validateInput(input);

  const costs = {
    provisionRupiah: input.costs?.provisionRupiah ?? 0n,
    administrationRupiah: input.costs?.administrationRupiah ?? 0n,
    insuranceRupiah: input.costs?.insuranceRupiah ?? 0n,
    taxAndNotaryRupiah: input.costs?.taxAndNotaryRupiah ?? 0n,
  };
  const feesRupiah = checkedSum(Object.values(costs), "Total biaya awal");
  const schedule: KprInstallment[] = [];
  let balance = input.principalRupiah;
  let previousMonthHadExtraRepayment = false;
  let hasHadExtraRepayment = false;
  let totalInterest = 0n;
  let totalRegularPrincipal = 0n;
  let totalRegularInstallments = 0n;
  let totalExtraPrincipal = 0n;

  for (let month = 1; month <= input.termMonths && balance > 0n; month += 1) {
    const rateBasisPoints =
      input.floatingRate && month > input.floatingRate.fixedMonths
        ? input.floatingRate.annualRateBasisPoints
        : input.annualRateBasisPoints;
    const remainingMonths = input.termMonths - month + 1;
    const openingBalance = balance;
    const interestBasis =
      input.model === "flat" ? input.principalRupiah : openingBalance;
    const interest = roundRatio(
      interestBasis * rateBasisPoints,
      MONTHLY_RATE_DENOMINATOR,
      "half-away-from-zero",
    );
    let scheduledPrincipal: bigint;
    let payment: bigint;
    let finalAdjustment = false;

    if (month === input.termMonths) {
      scheduledPrincipal = openingBalance;
      payment = scheduledPrincipal + interest;
      finalAdjustment = true;
    } else if (input.model === "annuity") {
      const rateChanged =
        input.floatingRate && month === input.floatingRate.fixedMonths + 1;
      const mustRecalculate =
        month === 1 || rateChanged || previousMonthHadExtraRepayment;
      const regularPayment = mustRecalculate
        ? annuityPayment(openingBalance, rateBasisPoints, remainingMonths)
        : schedule[month - 2]!.installmentRupiah;
      if (regularPayment <= interest) {
        throw new KprCalculationError(
          "invalid_rate",
          "Angsuran tidak menutup bunga pada periode ini.",
        );
      }
      scheduledPrincipal =
        regularPayment - interest > openingBalance
          ? openingBalance
          : regularPayment - interest;
      payment = scheduledPrincipal + interest;
    } else {
      const principalBasis =
        input.model === "flat" && !hasHadExtraRepayment
          ? input.principalRupiah
          : openingBalance;
      const principalPeriods =
        input.model === "flat" && !hasHadExtraRepayment
          ? input.termMonths
          : remainingMonths;
      scheduledPrincipal = roundRatio(
        principalBasis,
        BigInt(principalPeriods),
        "half-away-from-zero",
      );
      if (scheduledPrincipal > openingBalance) {
        scheduledPrincipal = openingBalance;
        finalAdjustment = true;
      }
      payment = scheduledPrincipal + interest;
    }

    let closingBalance = openingBalance - scheduledPrincipal;
    let extraPrincipal = 0n;
    if (
      input.earlyRepayment?.month === month &&
      closingBalance > 0n
    ) {
      extraPrincipal =
        input.earlyRepayment.amountRupiah > closingBalance
          ? closingBalance
          : input.earlyRepayment.amountRupiah;
      closingBalance -= extraPrincipal;
    }

    assertSafeRupiah(payment, "Angsuran bulanan");
    assertSafeRupiah(interest, "Bunga bulanan");
    totalInterest += interest;
    totalRegularPrincipal += scheduledPrincipal;
    totalRegularInstallments += payment;
    totalExtraPrincipal += extraPrincipal;
    for (const [label, amount] of [
      ["Total bunga", totalInterest],
      ["Total pokok terjadwal", totalRegularPrincipal],
      ["Total angsuran", totalRegularInstallments],
      ["Total pelunasan tambahan", totalExtraPrincipal],
    ] as const) {
      assertSafeRupiah(amount, label);
    }

    schedule.push({
      month,
      annualRateBasisPoints: rateBasisPoints,
      openingBalanceRupiah: openingBalance,
      installmentRupiah: payment,
      interestRupiah: interest,
      principalRupiah: scheduledPrincipal,
      extraPrincipalRupiah: extraPrincipal,
      closingBalanceRupiah: closingBalance,
      isFinalAdjustment: finalAdjustment,
    });
    balance = closingBalance;
    previousMonthHadExtraRepayment = extraPrincipal > 0n;
    hasHadExtraRepayment ||= previousMonthHadExtraRepayment;
  }

  const repaidPrincipalRupiah = checkedSum(
    [totalRegularPrincipal, totalExtraPrincipal],
    "Total pokok terbayar",
  );
  const totalCashOutflowRupiah = checkedSum(
    [totalRegularInstallments, totalExtraPrincipal, feesRupiah],
    "Total pengeluaran",
  );
  const actualTermMonths = schedule.length;
  const first = schedule[0];
  const last = schedule.at(-1);
  if (!first || !last || balance !== 0n || repaidPrincipalRupiah !== input.principalRupiah) {
    throw new KprCalculationError(
      "calculation_overflow",
      "Jadwal tidak dapat direkonsiliasi hingga saldo pokok nol.",
    );
  }

  const assumptions = [
    "Suku bunga tahunan yang dimasukkan adalah asumsi pengguna, bukan penawaran bank.",
    "Bunga nominal tahunan dibagi 12; pembayaran dilakukan pada akhir setiap bulan.",
    "Bunga tiap bulan dihitung dari saldo awal periode dan dibulatkan ke Rupiah terdekat (setengah menjauh dari nol).",
    "Biaya provisi, administrasi, asuransi, pajak, dan notaris ditampilkan terpisah; tidak dikapitalisasi atau dimasukkan ke saldo pinjaman.",
    "Tidak ada penalti, potongan bunga, biaya pelunasan, masa tenggang, atau aturan khusus produk bank yang diasumsikan.",
  ];
  if (input.model === "flat") {
    assumptions.push(
      "Model flat memakai pokok awal sebagai dasar bunga setiap bulan; pembayaran pokok dipercepat tidak mengubah dasar bunga, tetapi porsi pokok berikutnya dibagi ulang selama tenor tersisa.",
    );
  }
  if (input.earlyRepayment) {
    assumptions.push(
      "Pelunasan dipercepat adalah pembayaran pokok tambahan setelah angsuran bulan yang dipilih; angsuran/porsi pokok berikutnya dihitung ulang selama tenor tersisa.",
    );
  }
  if (input.floatingRate) {
    assumptions.push(
      "Saat periode bunga tetap berakhir, angsuran anuitas/pokok dihitung ulang dari saldo dan tenor tersisa dengan suku bunga mengambang yang dimasukkan pengguna.",
    );
  }

  return {
    method: {
      key: METHOD_KEY,
      version: METHOD_VERSION,
      model: input.model,
      rateConversion: "nominal-annual-divided-by-12",
      paymentTiming: "monthly-in-arrears",
      monthlyInterestPrecision: "Rupiah utuh, half-away-from-zero",
    },
    input,
    schedule,
    totals: {
      principalRupiah: input.principalRupiah,
      interestRupiah: totalInterest,
      repaidPrincipalRupiah,
      installmentsRupiah: totalRegularInstallments,
      extraRepaymentsRupiah: totalExtraPrincipal,
      feesRupiah,
      totalCashOutflowRupiah,
      firstInstallmentRupiah: first.installmentRupiah,
      lastInstallmentRupiah: last.installmentRupiah,
      actualTermMonths,
    },
    costs,
    assumptions,
    warnings: [
      "Simulasi matematis, bukan penawaran, persetujuan kredit, atau kepastian biaya dari bank.",
      "Periksa metode, biaya, suku bunga, dan ketentuan pelunasan pada dokumen produk bank yang berlaku.",
    ],
  };
}

/** Human-readable method label for the UI and reports. */
export function getKprModelLabel(model: KprModel): string {
  return modelName(model);
}

export const KPR_MONTHS_PER_YEAR = MONTHS_PER_YEAR;
