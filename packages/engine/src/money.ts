const MAX_AMOUNT = 999_999_999_999_999_999n;
const BASIS_POINTS_PER_WHOLE = 10_000n;
const PERCENTAGE_METHOD_KEY = "core.percentage";

export type EngineDomainErrorCode =
  | "invalid_amount"
  | "amount_out_of_range"
  | "invalid_rate"
  | "invalid_rounding_mode"
  | "division_by_zero"
  | "invalid_method_version";

export class EngineDomainError extends Error {
  constructor(
    readonly code: EngineDomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "EngineDomainError";
  }
}

export type RoundingMode = "half-away-from-zero" | "floor" | "ceiling";

export interface CalculationStep {
  readonly key: string;
  readonly label: string;
  readonly formula: string;
  readonly resultRupiah: bigint;
}

export interface CalculationResult {
  readonly input: {
    readonly amountRupiah: bigint;
    readonly rateBasisPoints: bigint;
  };
  readonly resultRupiah: bigint;
  readonly steps: readonly CalculationStep[];
  readonly assumptions: readonly string[];
  readonly warnings: readonly string[];
  readonly rounding: {
    readonly mode: RoundingMode;
    readonly precision: "Rupiah utuh";
    readonly appliedAt: "hasil akhir";
    readonly description: string;
  };
  readonly method: {
    readonly key: string;
    readonly version: string;
  };
}

const roundingDescriptions: Record<RoundingMode, string> = {
  "half-away-from-zero": "Pembulatan ke Rupiah terdekat; tepat setengah menjauhi nol.",
  floor: "Pembulatan ke bawah menuju negatif tak terhingga.",
  ceiling: "Pembulatan ke atas menuju positif tak terhingga.",
};

function assertRoundingMode(mode: RoundingMode): void {
  if (
    mode !== "half-away-from-zero" &&
    mode !== "floor" &&
    mode !== "ceiling"
  ) {
    throw new EngineDomainError(
      "invalid_rounding_mode",
      "Metode pembulatan tidak dikenali.",
    );
  }
}

function assertAmount(amount: bigint): void {
  if (typeof amount !== "bigint" || amount < 0n) {
    throw new EngineDomainError(
      "invalid_amount",
      "Nominal dasar harus berupa Rupiah utuh yang tidak negatif.",
    );
  }
  if (amount > MAX_AMOUNT) {
    throw new EngineDomainError(
      "amount_out_of_range",
      "Nominal dasar melampaui batas 18 digit Rupiah.",
    );
  }
}

/**
 * Divide exact integers and apply a named rounding rule without floating point.
 * The denominator may be negative; zero is always rejected.
 */
export function roundRatio(
  numerator: bigint,
  denominator: bigint,
  mode: RoundingMode,
): bigint {
  if (denominator === 0n) {
    throw new EngineDomainError(
      "division_by_zero",
      "Pembagi tidak boleh nol.",
    );
  }
  assertRoundingMode(mode);

  const signedNumerator = denominator < 0n ? -numerator : numerator;
  const positiveDenominator = denominator < 0n ? -denominator : denominator;
  const quotient = signedNumerator / positiveDenominator;
  const remainder = signedNumerator % positiveDenominator;
  if (remainder === 0n) return quotient;

  if (mode === "floor") return signedNumerator < 0n ? quotient - 1n : quotient;
  if (mode === "ceiling") return signedNumerator > 0n ? quotient + 1n : quotient;

  const absoluteRemainder = remainder < 0n ? -remainder : remainder;
  const isAtLeastHalf = absoluteRemainder * 2n >= positiveDenominator;
  if (!isAtLeastHalf) return quotient;
  return quotient + (signedNumerator < 0n ? -1n : 1n);
}

/**
 * A generic, user-rate percentage calculation for exercising the shared core.
 * It is not a tax, fee, bank offer, or other official tariff calculator.
 */
export function calculatePercentage(input: {
  readonly amountRupiah: bigint;
  readonly rateBasisPoints: bigint;
  readonly rounding: RoundingMode;
  readonly methodVersion: string;
}): CalculationResult {
  assertAmount(input.amountRupiah);
  if (
    typeof input.rateBasisPoints !== "bigint" ||
    input.rateBasisPoints < 0n ||
    input.rateBasisPoints > BASIS_POINTS_PER_WHOLE
  ) {
    throw new EngineDomainError(
      "invalid_rate",
      "Persentase harus berada di antara 0 dan 100 persen.",
    );
  }
  assertRoundingMode(input.rounding);
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}$/.test(input.methodVersion)) {
    throw new EngineDomainError(
      "invalid_method_version",
      "Versi metode harus diisi dalam format yang dapat direproduksi.",
    );
  }

  const numerator = input.amountRupiah * input.rateBasisPoints;
  const resultRupiah = roundRatio(
    numerator,
    BASIS_POINTS_PER_WHOLE,
    input.rounding,
  );

  return {
    input: {
      amountRupiah: input.amountRupiah,
      rateBasisPoints: input.rateBasisPoints,
    },
    resultRupiah,
    steps: [
      {
        key: "base",
        label: "Nominal dasar",
        formula: "Nilai Rupiah yang dimasukkan pengguna.",
        resultRupiah: input.amountRupiah,
      },
      {
        key: "percentage",
        label: "Persentase eksak",
        formula: `${input.amountRupiah.toString()} × ${input.rateBasisPoints.toString()} / 10000; dibulatkan pada hasil akhir.`,
        resultRupiah,
      },
    ],
    assumptions: [
      "Persentase adalah input pengguna, bukan tarif atau aturan resmi.",
      "Perhitungan memakai basis point dan Rupiah utuh; tidak memakai floating point.",
    ],
    warnings: [],
    rounding: {
      mode: input.rounding,
      precision: "Rupiah utuh",
      appliedAt: "hasil akhir",
      description: roundingDescriptions[input.rounding],
    },
    method: {
      key: PERCENTAGE_METHOD_KEY,
      version: input.methodVersion,
    },
  };
}

/**
 * Stable JSON representation for sharing or replaying a calculation.
 * BigInt values are serialized as decimal strings in a fixed property order.
 */
export function serializeCalculationResult(result: CalculationResult): string {
  return JSON.stringify({
    method: result.method,
    input: {
      amountRupiah: result.input.amountRupiah.toString(),
      rateBasisPoints: result.input.rateBasisPoints.toString(),
    },
    resultRupiah: result.resultRupiah.toString(),
    steps: result.steps.map((step) => ({
      key: step.key,
      label: step.label,
      formula: step.formula,
      resultRupiah: step.resultRupiah.toString(),
    })),
    assumptions: [...result.assumptions],
    warnings: [...result.warnings],
    rounding: result.rounding,
  });
}
