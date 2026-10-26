const plainInteger = /^[0-9]+$/;
const groupedInteger = /^(?:0|[1-9][0-9]{0,2})(?:\.[0-9]{3})+$/;

/**
 * Parse whole-rupiah input without converting through floating point.
 * Accepts ungrouped digits or Indonesian dot-separated thousands.
 */
export function parseRupiahInput(raw: string): bigint | null {
  const input = raw.trim();
  if (input === "") return null;
  if (!plainInteger.test(input) && !groupedInteger.test(input)) {
    throw new Error("Masukkan angka Rupiah utuh, misalnya 1500000 atau 1.500.000.");
  }
  return BigInt(input.replaceAll(".", ""));
}

export function formatRupiah(value: bigint): string {
  if (value < 0n) throw new RangeError("Nominal Rupiah tidak boleh negatif.");
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value);
}
