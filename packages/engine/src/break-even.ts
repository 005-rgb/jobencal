import { roundRatio } from "./money.js";

const MAX_RUPIAH = 999_999_999_999_999_999n;
export const BREAK_EVEN_METHOD_KEY = "business.break-even-point";
export const BREAK_EVEN_METHOD_VERSION = "1.6.0";

export interface BreakEvenInput {
  readonly fixedCostRupiah: bigint;
  readonly sellingPricePerUnitRupiah: bigint;
  readonly variableCostPerUnitRupiah: bigint;
}

export interface BreakEvenCalculation {
  readonly method: {
    readonly key: typeof BREAK_EVEN_METHOD_KEY;
    readonly version: typeof BREAK_EVEN_METHOD_VERSION;
    readonly rounding: string;
  };
  readonly input: BreakEvenInput;
  readonly contributionPerUnitRupiah: bigint;
  readonly breakEvenUnitsExact: {
    readonly numerator: bigint;
    readonly denominator: bigint;
  };
  readonly breakEvenUnitsWhole: bigint;
  readonly salesAtExactBreakEvenRupiah: bigint;
  readonly salesAtWholeUnitThresholdRupiah: bigint;
  readonly profitOneUnitBeforeRupiah: bigint | null;
  readonly profitAtWholeUnitThresholdRupiah: bigint;
  readonly profitOneUnitAfterRupiah: bigint;
  readonly assumptions: readonly string[];
  readonly warnings: readonly string[];
}

export type BreakEvenErrorCode =
  | "invalid_cost"
  | "invalid_selling_price"
  | "unreachable_break_even"
  | "calculation_overflow";

export class BreakEvenCalculationError extends Error {
  constructor(readonly code: BreakEvenErrorCode, message: string) {
    super(message);
    this.name = "BreakEvenCalculationError";
  }
}

function assertMoney(value: bigint, label: string): void {
  if (typeof value !== "bigint" || value < 0n) {
    throw new BreakEvenCalculationError(
      "invalid_cost",
      `${label} harus berupa Rupiah utuh dan tidak negatif.`,
    );
  }
  if (value > MAX_RUPIAH) {
    throw new BreakEvenCalculationError(
      "calculation_overflow",
      `${label} melebihi batas Rupiah 18 digit.`,
    );
  }
}

function checkedMoney(value: bigint, label: string): bigint {
  if (value < 0n || value > MAX_RUPIAH) {
    throw new BreakEvenCalculationError(
      "calculation_overflow",
      `${label} melampaui batas Rupiah yang didukung.`,
    );
  }
  return value;
}

function checkedProfit(value: bigint, label: string): bigint {
  if (value < -MAX_RUPIAH || value > MAX_RUPIAH) {
    throw new BreakEvenCalculationError(
      "calculation_overflow",
      `${label} melampaui batas Rupiah yang didukung.`,
    );
  }
  return value;
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left;
  let b = right;
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a;
}

function profitAtUnits(
  units: bigint,
  contributionPerUnitRupiah: bigint,
  fixedCostRupiah: bigint,
  label: string,
): bigint {
  return checkedProfit(
    contributionPerUnitRupiah * units - fixedCostRupiah,
    label,
  );
}

export function calculateBreakEven(
  input: BreakEvenInput,
): BreakEvenCalculation {
  assertMoney(input.fixedCostRupiah, "Biaya tetap");
  assertMoney(input.variableCostPerUnitRupiah, "Biaya variabel per unit");
  assertMoney(input.sellingPricePerUnitRupiah, "Harga jual per unit");
  if (input.sellingPricePerUnitRupiah === 0n) {
    throw new BreakEvenCalculationError(
      "invalid_selling_price",
      "Harga jual per unit harus lebih besar dari nol.",
    );
  }

  const contribution =
    input.sellingPricePerUnitRupiah - input.variableCostPerUnitRupiah;
  if (contribution <= 0n) {
    throw new BreakEvenCalculationError(
      "unreachable_break_even",
      contribution === 0n
        ? "Kontribusi per unit nol; BEP tidak tercapai dengan asumsi ini."
        : "Kontribusi per unit negatif; BEP tidak tercapai dengan asumsi ini.",
    );
  }

  const divisor = greatestCommonDivisor(input.fixedCostRupiah, contribution);
  const exactUnits = {
    numerator: input.fixedCostRupiah / divisor,
    denominator: contribution / divisor,
  };
  const wholeUnits = roundRatio(
    input.fixedCostRupiah,
    contribution,
    "ceiling",
  );
  const exactSalesNumerator =
    input.fixedCostRupiah * input.sellingPricePerUnitRupiah;
  if (exactSalesNumerator > MAX_RUPIAH * contribution) {
    throw new BreakEvenCalculationError(
      "calculation_overflow",
      "Nilai penjualan pada BEP melampaui batas Rupiah yang didukung.",
    );
  }
  const salesAtExactBreakEven = checkedMoney(
    roundRatio(
      exactSalesNumerator,
      contribution,
      "half-away-from-zero",
    ),
    "Nilai penjualan pada BEP",
  );
  const salesAtWholeUnitThreshold = checkedMoney(
    wholeUnits * input.sellingPricePerUnitRupiah,
    "Nilai penjualan pada jumlah unit utuh minimum",
  );
  const unitsBefore = wholeUnits > 0n ? wholeUnits - 1n : null;

  return {
    method: {
      key: BREAK_EVEN_METHOD_KEY,
      version: BREAK_EVEN_METHOD_VERSION,
      rounding:
        "Rasio BEP unit dipertahankan sebagai pecahan eksak; jumlah unit utuh dibulatkan ke atas; nilai penjualan dibulatkan half-away-from-zero ke Rupiah.",
    },
    input,
    contributionPerUnitRupiah: contribution,
    breakEvenUnitsExact: exactUnits,
    breakEvenUnitsWhole: wholeUnits,
    salesAtExactBreakEvenRupiah: salesAtExactBreakEven,
    salesAtWholeUnitThresholdRupiah: salesAtWholeUnitThreshold,
    profitOneUnitBeforeRupiah:
      unitsBefore === null
        ? null
        : profitAtUnits(
            unitsBefore,
            contribution,
            input.fixedCostRupiah,
            "Laba/rugi satu unit sebelum ambang BEP",
          ),
    profitAtWholeUnitThresholdRupiah: profitAtUnits(
      wholeUnits,
      contribution,
      input.fixedCostRupiah,
      "Laba/rugi pada ambang unit utuh BEP",
    ),
    profitOneUnitAfterRupiah: profitAtUnits(
      wholeUnits + 1n,
      contribution,
      input.fixedCostRupiah,
      "Laba/rugi satu unit setelah ambang BEP",
    ),
    assumptions: [
      "Biaya tetap berlaku untuk periode yang sama dengan penjualan yang dihitung.",
      "Harga jual dan biaya variabel per unit dianggap sama untuk setiap unit.",
      "Biaya selain biaya tetap dan biaya variabel per unit tidak dimasukkan.",
      "Rumus: kontribusi per unit = harga jual per unit − biaya variabel per unit; BEP unit = biaya tetap ÷ kontribusi per unit.",
    ],
    warnings:
      input.fixedCostRupiah % contribution === 0n
        ? []
        : [
            "BEP unit berupa pecahan. Jumlah unit utuh minimum dibulatkan ke atas; laba pada ambang unit utuh dapat melebihi nol.",
          ],
  };
}
