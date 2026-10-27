import { roundRatio } from "./money.js";

const MAX_RUPIAH = 999_999_999_999_999_999n;
const BASIS_POINTS = 10_000n;
const MAX_MARKUP_BASIS_POINTS = 100_000_000n;
const METHOD_KEY = "selling-price.margin-markup";
const METHOD_VERSION = "1.5.0";

interface PriceMarginCommonInput {
  readonly baseCostRupiah: bigint;
  /** Discount applied to the listed price. */
  readonly discountBasisPoints: bigint;
  /** Both percentages below are applied to sales after discount. */
  readonly platformFeeBasisPoints: bigint;
  readonly taxBasisPoints: bigint;
  readonly fixedSaleCostRupiah: bigint;
}

export type PriceMarginInput = PriceMarginCommonInput &
  (
    | {
        readonly mode: "margin" | "markup";
        readonly targetBasisPoints: bigint;
      }
    | {
        readonly mode: "analyze";
        readonly sellingPriceRupiah: bigint;
      }
  );

export type PriceMarginErrorCode =
  | "invalid_cost"
  | "invalid_price"
  | "invalid_percentage"
  | "invalid_target"
  | "impossible_target"
  | "calculation_overflow";

export class PriceMarginCalculationError extends Error {
  constructor(readonly code: PriceMarginErrorCode, message: string) {
    super(message);
    this.name = "PriceMarginCalculationError";
  }
}

export interface PriceMarginCalculation {
  readonly method: {
    readonly key: typeof METHOD_KEY;
    readonly version: typeof METHOD_VERSION;
    readonly rounding: string;
  };
  readonly input: PriceMarginInput;
  readonly listedPriceRupiah: bigint;
  readonly discountRupiah: bigint;
  readonly netSalesRupiah: bigint;
  readonly platformFeeRupiah: bigint;
  readonly taxRupiah: bigint;
  readonly baseCostRupiah: bigint;
  readonly fixedSaleCostRupiah: bigint;
  readonly profitRupiah: bigint;
  readonly actualMarginBasisPoints: bigint | null;
  readonly actualMarkupBasisPoints: bigint;
  readonly assumptions: readonly string[];
  readonly warnings: readonly string[];
}

function assertRupiah(value: bigint, label: string): void {
  if (typeof value !== "bigint" || value < 0n) {
    throw new PriceMarginCalculationError(
      "invalid_cost",
      `${label} harus berupa Rupiah utuh dan tidak negatif.`,
    );
  }
  if (value > MAX_RUPIAH) {
    throw new PriceMarginCalculationError(
      "calculation_overflow",
      `${label} melampaui batas Rupiah 18 digit.`,
    );
  }
}

function assertRate(value: bigint, label: string): void {
  if (
    typeof value !== "bigint" ||
    value < 0n ||
    value > BASIS_POINTS
  ) {
    throw new PriceMarginCalculationError(
      "invalid_percentage",
      `${label} harus berada di antara 0% dan 100%.`,
    );
  }
}

function checkedSignedRupiah(value: bigint, label: string): bigint {
  if (value > MAX_RUPIAH || value < -MAX_RUPIAH) {
    throw new PriceMarginCalculationError(
      "calculation_overflow",
      `${label} melampaui batas Rupiah 18 digit.`,
    );
  }
  return value;
}

function ceilingRatio(numerator: bigint, denominator: bigint): bigint {
  return roundRatio(numerator, denominator, "ceiling");
}

function validateCommonInput(input: PriceMarginCommonInput): void {
  assertRupiah(input.baseCostRupiah, "Biaya dasar");
  if (input.baseCostRupiah === 0n) {
    throw new PriceMarginCalculationError(
      "invalid_cost",
      "Biaya dasar harus lebih besar dari nol agar margin dan markup dapat ditentukan.",
    );
  }
  assertRupiah(input.fixedSaleCostRupiah, "Biaya tetap per transaksi");
  if (input.baseCostRupiah + input.fixedSaleCostRupiah > MAX_RUPIAH) {
    throw new PriceMarginCalculationError(
      "calculation_overflow",
      "Gabungan biaya dasar dan biaya tetap melampaui batas Rupiah.",
    );
  }
  assertRate(input.discountBasisPoints, "Diskon");
  assertRate(input.platformFeeBasisPoints, "Biaya platform");
  assertRate(input.taxBasisPoints, "Pajak input pengguna");
}

function calculateTargetListedPrice(input: PriceMarginInput): bigint {
  if (input.mode === "analyze") return input.sellingPriceRupiah;

  const discountFactor = BASIS_POINTS - input.discountBasisPoints;
  const chargeFactor =
    BASIS_POINTS - input.platformFeeBasisPoints - input.taxBasisPoints;

  if (discountFactor <= 0n) {
    throw new PriceMarginCalculationError(
      "impossible_target",
      "Harga target tidak dapat dihitung dengan diskon 100%.",
    );
  }

  if (input.mode === "margin") {
    if (
      typeof input.targetBasisPoints !== "bigint" ||
      input.targetBasisPoints < 0n ||
      input.targetBasisPoints > BASIS_POINTS
    ) {
      throw new PriceMarginCalculationError(
        "invalid_target",
        "Target margin harus berada di antara 0% dan 100%.",
      );
    }
    const remainingFactor = chargeFactor - input.targetBasisPoints;
    if (remainingFactor <= 0n) {
      throw new PriceMarginCalculationError(
        "impossible_target",
        "Target margin tidak mungkin: target margin ditambah pajak dan biaya platform harus kurang dari 100%.",
      );
    }
    const numerator =
      (input.baseCostRupiah + input.fixedSaleCostRupiah) *
      BASIS_POINTS *
      BASIS_POINTS;
    return ceilingRatio(numerator, discountFactor * remainingFactor);
  }

  if (
    typeof input.targetBasisPoints !== "bigint" ||
    input.targetBasisPoints < 0n ||
    input.targetBasisPoints > MAX_MARKUP_BASIS_POINTS
  ) {
    throw new PriceMarginCalculationError(
      "invalid_target",
      "Target markup harus berada di antara 0% dan 1.000.000%.",
    );
  }
  if (chargeFactor <= 0n) {
    throw new PriceMarginCalculationError(
      "impossible_target",
      "Harga target tidak mungkin karena pajak dan biaya platform mencapai atau melebihi 100% omzet setelah diskon.",
    );
  }
  const costAndTargetProfit =
    input.baseCostRupiah * (BASIS_POINTS + input.targetBasisPoints) +
    input.fixedSaleCostRupiah * BASIS_POINTS;
  return ceilingRatio(
    costAndTargetProfit * BASIS_POINTS,
    discountFactor * chargeFactor,
  );
}

export function calculatePriceMargin(
  input: PriceMarginInput,
): PriceMarginCalculation {
  validateCommonInput(input);
  if (input.mode === "analyze") {
    assertRupiah(input.sellingPriceRupiah, "Harga jual");
  }

  const listedPriceRupiah = calculateTargetListedPrice(input);
  assertRupiah(listedPriceRupiah, "Harga jual hasil");

  const discountRupiah = roundRatio(
    listedPriceRupiah * input.discountBasisPoints,
    BASIS_POINTS,
    "half-away-from-zero",
  );
  const netSalesRupiah = listedPriceRupiah - discountRupiah;
  const platformFeeRupiah = roundRatio(
    netSalesRupiah * input.platformFeeBasisPoints,
    BASIS_POINTS,
    "half-away-from-zero",
  );
  const taxRupiah = roundRatio(
    netSalesRupiah * input.taxBasisPoints,
    BASIS_POINTS,
    "half-away-from-zero",
  );
  const profitRupiah = checkedSignedRupiah(
    netSalesRupiah -
      platformFeeRupiah -
      taxRupiah -
      input.baseCostRupiah -
      input.fixedSaleCostRupiah,
    "Laba bersih",
  );
  const actualMarginBasisPoints =
    netSalesRupiah === 0n
      ? null
      : roundRatio(
          profitRupiah * BASIS_POINTS,
          netSalesRupiah,
          "half-away-from-zero",
        );
  const actualMarkupBasisPoints = roundRatio(
    profitRupiah * BASIS_POINTS,
    input.baseCostRupiah,
    "half-away-from-zero",
  );
  const warnings: string[] = [];

  if (input.mode === "analyze") {
    if (profitRupiah < 0n) {
      warnings.push(
        "Harga ini belum menutup biaya dasar, biaya tetap, serta potongan yang Anda masukkan.",
      );
    }
    if (actualMarginBasisPoints === null) {
      warnings.push(
        "Omzet setelah diskon adalah Rp 0; persentase margin tidak dapat ditentukan.",
      );
    }
  } else {
    const targetNumerator =
      input.mode === "margin"
        ? netSalesRupiah * input.targetBasisPoints
        : input.baseCostRupiah * input.targetBasisPoints;
    if (profitRupiah * BASIS_POINTS !== targetNumerator) {
      warnings.push(
        "Margin atau markup aktual sedikit berbeda dari target karena harga, diskon, biaya platform, dan pajak dibulatkan ke Rupiah utuh.",
      );
    }
  }

  return {
    method: {
      key: METHOD_KEY,
      version: METHOD_VERSION,
      rounding:
        "Harga target dibulatkan ke atas; diskon, biaya platform, dan pajak dibulatkan half-away-from-zero ke Rupiah utuh.",
    },
    input,
    listedPriceRupiah,
    discountRupiah,
    netSalesRupiah,
    platformFeeRupiah,
    taxRupiah,
    baseCostRupiah: input.baseCostRupiah,
    fixedSaleCostRupiah: input.fixedSaleCostRupiah,
    profitRupiah,
    actualMarginBasisPoints,
    actualMarkupBasisPoints,
    assumptions: [
      "Margin = laba bersih ÷ omzet setelah diskon; biaya platform dan pajak input pengguna mengurangi laba.",
      "Markup = laba bersih ÷ biaya dasar; biaya tetap per transaksi mengurangi laba tetapi tidak menambah dasar markup.",
      "Diskon memakai harga tertera. Biaya platform dan pajak yang dimasukkan pengguna masing-masing dihitung dari omzet setelah diskon, bukan secara bertingkat.",
      "Pajak, biaya platform, diskon, dan biaya tetap bersifat opsional; yang kosong berarti tidak dimasukkan.",
      "Tarif sepenuhnya berasal dari input pengguna. Ini bukan kalkulator pajak dan tidak memverifikasi tarif resmi.",
      "Aritmetika memakai Rupiah utuh dan basis point integer; tidak memakai floating point.",
    ],
    warnings,
  };
}
