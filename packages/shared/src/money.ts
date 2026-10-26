const plainInteger = /^[0-9]+$/;
const groupedInteger = /^(?:0|[1-9][0-9]{0,2})(?:\.[0-9]{3})+$/;

/**
 * Domain limit: signed whole-rupiah values of at most 18 digits.
 * Keep this bound in sync with packages/engine's arithmetic boundary.
 */
export const MAX_RUPIAH = 999_999_999_999_999_999n;

export type SharedDomainErrorCode =
  | "invalid_money_input"
  | "money_out_of_range"
  | "invalid_percentage_input"
  | "percentage_out_of_range";

export class SharedDomainError extends Error {
  constructor(
    readonly code: SharedDomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SharedDomainError";
  }
}

/**
 * Parse whole-rupiah input without converting through floating point.
 * Accepts ungrouped digits or Indonesian dot-separated thousands.
 */
export function parseRupiahInput(raw: string): bigint | null {
  const input = raw.trim();
  if (input === "") return null;
  if (!plainInteger.test(input) && !groupedInteger.test(input)) {
    throw new SharedDomainError(
      "invalid_money_input",
      "Masukkan angka Rupiah utuh, misalnya 1500000 atau 1.500.000.",
    );
  }
  const amount = BigInt(input.replaceAll(".", ""));
  if (amount > MAX_RUPIAH) {
    throw new SharedDomainError(
      "money_out_of_range",
      `Nominal melampaui batas ${MAX_RUPIAH.toString()} Rupiah.`,
    );
  }
  return amount;
}

export function formatRupiah(value: bigint): string {
  if (value > MAX_RUPIAH || value < -MAX_RUPIAH) {
    throw new SharedDomainError(
      "money_out_of_range",
      `Nominal harus berada di antara -${MAX_RUPIAH.toString()} dan ${MAX_RUPIAH.toString()} Rupiah.`,
    );
  }
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value);
}

/**
 * Parse a non-negative Indonesian percentage with up to two decimal places.
 * The result is integer basis points: 2,5% becomes 250.
 */
export function parsePercentageInput(raw: string): bigint | null {
  const input = raw.trim();
  if (input === "") return null;
  const match = /^(0|[1-9][0-9]{0,2})(?:,([0-9]{1,2}))?$/.exec(input);
  if (!match) {
    throw new SharedDomainError(
      "invalid_percentage_input",
      "Masukkan persentase dengan koma desimal, maksimal dua angka di belakang koma.",
    );
  }

  const whole = BigInt(match[1]!);
  const fraction = BigInt((match[2] ?? "").padEnd(2, "0") || "0");
  const basisPoints = whole * 100n + fraction;
  if (basisPoints > 10_000n) {
    throw new SharedDomainError(
      "percentage_out_of_range",
      "Persentase harus berada di antara 0 dan 100.",
    );
  }
  return basisPoints;
}

export function formatPercentage(basisPoints: bigint): string {
  if (basisPoints < 0n || basisPoints > 10_000n) {
    throw new SharedDomainError(
      "percentage_out_of_range",
      "Persentase harus berada di antara 0 dan 100.",
    );
  }
  const whole = basisPoints / 100n;
  const fraction = (basisPoints % 100n).toString().padStart(2, "0");
  const decimal = fraction.endsWith("0") ? fraction[0] : fraction;
  return decimal === "0" ? whole.toString() : `${whole.toString()},${decimal}`;
}
