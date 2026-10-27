const MAX_INTEGER = 999_999_999_999_999_999n;
const MAX_FRACTION_DIGITS = 18;

export const TERBILANG_METHOD_KEY = "terbilang.number-to-words";
export const TERBILANG_METHOD_VERSION = "1.0.0";

const SCALES = [
  "",
  "ribu",
  "juta",
  "miliar",
  "triliun",
  "kuadriliun",
] as const;

const DIGITS = [
  "nol",
  "satu",
  "dua",
  "tiga",
  "empat",
  "lima",
  "enam",
  "tujuh",
  "delapan",
  "sembilan",
] as const;

export type TerbilangFormat = "angka" | "rupiah";

export type TerbilangErrorCode =
  | "invalid_input"
  | "invalid_format"
  | "amount_out_of_range";

export class TerbilangError extends Error {
  constructor(
    readonly code: TerbilangErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TerbilangError";
  }
}

export interface TerbilangInput {
  readonly value: string;
  readonly format: TerbilangFormat;
}

export interface TerbilangCalculation {
  readonly input: {
    readonly normalizedValue: string;
    readonly format: TerbilangFormat;
    readonly maximumInteger: string;
    readonly maximumFractionDigits: number;
  };
  readonly text: string;
  readonly steps: readonly {
    readonly key: string;
    readonly label: string;
    readonly result: string;
  }[];
  readonly assumptions: readonly string[];
  readonly warnings: readonly string[];
  readonly rounding: {
    readonly applied: false;
    readonly description: string;
  };
  readonly method: {
    readonly key: string;
    readonly version: string;
  };
  readonly provenance: {
    readonly standard: string;
    readonly sources: readonly string[];
    readonly checkedOn: string;
    readonly reviewStatus: "independent_review_pending";
  };
}

const PROVENANCE: TerbilangCalculation["provenance"] = {
  standard:
    "Bentuk numeralia baku Bahasa Indonesia; pembacaan desimal per digit dan tanda minus adalah konvensi produk yang dinyatakan.",
  sources: [
    "https://ejaan.kemendikdasmen.go.id/eyd/penulisan-kata/angka-dan-bilangan",
    "https://kbbi.kemendikdasmen.go.id/entri/kuadriliun",
    "https://repositori.kemendikdasmen.go.id/16351/1/Tata%20Bahasa%20Baku%20Bahasa%20Ind.pdf",
  ],
  checkedOn: "2026-10-27",
  reviewStatus: "independent_review_pending",
};

function spellBelowOneThousand(value: number): string {
  const words: string[] = [];
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;

  if (hundreds > 0) {
    words.push(hundreds === 1 ? "seratus" : `${DIGITS[hundreds]} ratus`);
  }

  if (remainder >= 10 && remainder <= 11) {
    words.push(remainder === 10 ? "sepuluh" : "sebelas");
  } else if (remainder >= 12 && remainder <= 19) {
    words.push(`${DIGITS[remainder - 10]} belas`);
  } else if (remainder >= 20) {
    words.push(`${DIGITS[Math.floor(remainder / 10)]} puluh`);
    if (remainder % 10 > 0) words.push(DIGITS[remainder % 10]!);
  } else if (remainder > 0) {
    words.push(DIGITS[remainder]!);
  }

  return words.join(" ");
}

function spellInteger(value: bigint): string {
  if (value === 0n) return "nol";

  const chunks: number[] = [];
  let remaining = value;
  while (remaining > 0n) {
    chunks.push(Number(remaining % 1_000n));
    remaining /= 1_000n;
  }

  const words: string[] = [];
  for (let scaleIndex = chunks.length - 1; scaleIndex >= 0; scaleIndex -= 1) {
    const chunk = chunks[scaleIndex]!;
    if (chunk === 0) continue;

    if (scaleIndex === 1 && chunk === 1) {
      words.push("seribu");
    } else {
      const chunkWords = spellBelowOneThousand(chunk);
      const scale = SCALES[scaleIndex]!;
      words.push(scale ? `${chunkWords} ${scale}` : chunkWords);
    }
  }
  return words.join(" ");
}

function parseInput(value: string): {
  readonly negative: boolean;
  readonly integer: bigint;
  readonly integerDigits: string;
  readonly fractionDigits: string | undefined;
} {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TerbilangError("invalid_input", "Angka wajib diisi.");
  }

  const input = value.trim();
  if (input.length > 64) {
    throw new TerbilangError(
      "amount_out_of_range",
      "Input terlalu panjang. Periksa jumlah angka dan digit desimal.",
    );
  }

  const match = /^([−-]?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?$/.exec(input);
  if (!match) {
    throw new TerbilangError(
      "invalid_input",
      "Format tidak dikenali. Gunakan titik untuk kelompok ribuan dan koma untuk desimal, misalnya 1.234,50.",
    );
  }

  const integerDigits = match[2]!.replaceAll(".", "").replace(/^0+(?=\d)/, "");
  const fractionDigits = match[3];
  if (fractionDigits && fractionDigits.length > MAX_FRACTION_DIGITS) {
    throw new TerbilangError(
      "amount_out_of_range",
      `Pecahan dibatasi hingga ${MAX_FRACTION_DIGITS} digit.`,
    );
  }

  const integer = BigInt(integerDigits);
  if (integer > MAX_INTEGER) {
    throw new TerbilangError(
      "amount_out_of_range",
      "Bagian bilangan bulat melampaui batas 999.999.999.999.999.999.",
    );
  }

  const isZero = integer === 0n && (!fractionDigits || /^0+$/.test(fractionDigits));
  return {
    negative: match[1] !== "" && !isZero,
    integer,
    integerDigits,
    fractionDigits,
  };
}

function canonicalValue(
  parsed: ReturnType<typeof parseInput>,
): string {
  const sign = parsed.negative ? "-" : "";
  return `${sign}${parsed.integerDigits}${parsed.fractionDigits === undefined ? "" : `,${parsed.fractionDigits}`}`;
}

export function calculateTerbilang(
  input: TerbilangInput,
): TerbilangCalculation {
  if (input.format !== "angka" && input.format !== "rupiah") {
    throw new TerbilangError(
      "invalid_format",
      "Pilih format angka atau nominal Rupiah.",
    );
  }

  const parsed = parseInput(input.value);
  const integerWords = spellInteger(parsed.integer);
  const signWords = parsed.negative ? "minus " : "";
  const rupiahSuffix = input.format === "rupiah" ? " rupiah" : "";
  const fractionWords = parsed.fractionDigits
    ? ` koma ${[...parsed.fractionDigits]
        .map((digit) => DIGITS[Number(digit)]!)
        .join(" ")}`
    : "";
  const text = `${signWords}${integerWords}${rupiahSuffix}${fractionWords}`;

  return {
    input: {
      normalizedValue: canonicalValue(parsed),
      format: input.format,
      maximumInteger: MAX_INTEGER.toString(),
      maximumFractionDigits: MAX_FRACTION_DIGITS,
    },
    text,
    steps: [
      {
        key: "integer",
        label: "Bilangan bulat",
        result: `${signWords}${integerWords}${rupiahSuffix}`,
      },
      ...(parsed.fractionDigits
        ? [
            {
              key: "fraction",
              label: "Digit desimal",
              result: `koma ${[...parsed.fractionDigits]
                .map((digit) => DIGITS[Number(digit)]!)
                .join(" ")}`,
            },
          ]
        : []),
    ],
    assumptions: [
      "Titik hanya berfungsi sebagai pemisah kelompok tiga digit; koma adalah satu-satunya pemisah desimal.",
      "Setiap digit setelah koma dibaca satu per satu agar nilai dan nol di akhir tetap terjaga.",
      "Dalam format Rupiah, kata “rupiah” ditempatkan setelah bagian bilangan bulat; desimal tetap dibaca setelah kata “koma”.",
      "Bilangan bulat dibatasi sampai 999.999.999.999.999.999 dan pecahan sampai 18 digit.",
    ],
    warnings: [],
    rounding: {
      applied: false,
      description:
        "Tidak ada pembulatan: konversi teks mempertahankan semua digit yang dimasukkan.",
    },
    method: {
      key: TERBILANG_METHOD_KEY,
      version: TERBILANG_METHOD_VERSION,
    },
    provenance: PROVENANCE,
  };
}
