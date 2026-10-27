import { roundRatio } from "./money.js";

const MAX_RUPIAH = 999_999_999_999_999_999n;
const MAX_QUANTITY_THOUSANDTHS = 999_999_999_999n;
const QUANTITY_SCALE = 1_000n;

export const INVOICE_METHOD_KEY = "documents.invoice-receipt";
export const INVOICE_METHOD_VERSION = "1.11.0";

export type InvoiceDocumentType = "invoice" | "receipt";

export interface InvoiceLineInput {
  readonly description: string;
  /** Quantity scaled by 1,000; 1.250 units is represented as 1250n. */
  readonly quantityThousandths: bigint;
  readonly unit: string;
  readonly unitPriceRupiah: bigint;
}

export interface InvoiceReceiptInput {
  readonly documentType: InvoiceDocumentType;
  readonly documentNumber: string;
  readonly issueDate: string;
  readonly sellerName: string;
  readonly recipientName: string;
  readonly lines: readonly InvoiceLineInput[];
  readonly discountRupiah: bigint;
}

export type InvoiceCalculationErrorCode =
  | "invalid_document_type"
  | "invalid_document_number"
  | "invalid_issue_date"
  | "invalid_identity"
  | "invalid_lines"
  | "invalid_line_description"
  | "invalid_quantity"
  | "invalid_unit"
  | "invalid_unit_price"
  | "invalid_discount"
  | "discount_exceeds_subtotal"
  | "calculation_overflow";

export class InvoiceCalculationError extends Error {
  constructor(
    readonly code: InvoiceCalculationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "InvoiceCalculationError";
  }
}

export interface InvoiceReceiptLine {
  readonly description: string;
  readonly quantityThousandths: bigint;
  readonly unit: string;
  readonly unitPriceRupiah: bigint;
  readonly lineTotalRupiah: bigint;
}

export interface InvoiceReceiptCalculation {
  readonly method: {
    readonly key: typeof INVOICE_METHOD_KEY;
    readonly version: typeof INVOICE_METHOD_VERSION;
  };
  readonly documentType: InvoiceDocumentType;
  readonly documentNumber: string;
  readonly issueDate: string;
  readonly sellerName: string;
  readonly recipientName: string;
  readonly lines: readonly InvoiceReceiptLine[];
  readonly subtotalRupiah: bigint;
  readonly discountRupiah: bigint;
  readonly totalRupiah: bigint;
  readonly steps: readonly {
    readonly key: string;
    readonly label: string;
    readonly formula: string;
    readonly resultRupiah: bigint;
  }[];
  readonly assumptions: readonly string[];
  readonly warnings: readonly string[];
  readonly rounding: {
    readonly mode: "half-away-from-zero";
    readonly precision: "Rupiah utuh";
    readonly appliedAt: "setiap baris item";
    readonly description: string;
  };
}

function fail(code: InvoiceCalculationErrorCode, message: string): never {
  throw new InvoiceCalculationError(code, message);
}

function validateDocumentDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function checkedRupiah(value: bigint, label: string): bigint {
  if (typeof value !== "bigint" || value < 0n) {
    fail("invalid_unit_price", `${label} harus berupa Rupiah utuh yang tidak negatif.`);
  }
  if (value > MAX_RUPIAH) {
    fail("calculation_overflow", `${label} melampaui batas 18 digit Rupiah.`);
  }
  return value;
}

function validateInput(input: InvoiceReceiptInput): void {
  if (input.documentType !== "invoice" && input.documentType !== "receipt") {
    fail("invalid_document_type", "Jenis dokumen harus invoice atau kwitansi.");
  }
  if (
    typeof input.documentNumber !== "string" ||
    input.documentNumber.trim().length === 0 ||
    input.documentNumber.trim().length > 50
  ) {
    fail("invalid_document_number", "Nomor dokumen wajib diisi dan maksimal 50 karakter.");
  }
  if (typeof input.issueDate !== "string" || !validateDocumentDate(input.issueDate)) {
    fail("invalid_issue_date", "Tanggal dokumen harus berupa tanggal kalender yang sah.");
  }
  if (
    typeof input.sellerName !== "string" ||
    input.sellerName.trim().length === 0 ||
    input.sellerName.trim().length > 120 ||
    typeof input.recipientName !== "string" ||
    input.recipientName.trim().length === 0 ||
    input.recipientName.trim().length > 120
  ) {
    fail("invalid_identity", "Nama penjual dan penerima wajib diisi, maksimal 120 karakter.");
  }
  if (!Array.isArray(input.lines) || input.lines.length < 1 || input.lines.length > 100) {
    fail("invalid_lines", "Dokumen harus memiliki 1 sampai 100 baris item.");
  }
  if (typeof input.discountRupiah !== "bigint" || input.discountRupiah < 0n) {
    fail("invalid_discount", "Diskon harus berupa Rupiah utuh yang tidak negatif.");
  }
}

export function calculateInvoiceReceipt(
  input: InvoiceReceiptInput,
): InvoiceReceiptCalculation {
  validateInput(input);

  const lines = input.lines.map((line, index): InvoiceReceiptLine => {
    if (
      typeof line.description !== "string" ||
      line.description.trim().length === 0 ||
      line.description.trim().length > 200
    ) {
      fail(
        "invalid_line_description",
        `Nama item pada baris ${index + 1} wajib diisi dan maksimal 200 karakter.`,
      );
    }
    if (
      typeof line.quantityThousandths !== "bigint" ||
      line.quantityThousandths <= 0n ||
      line.quantityThousandths > MAX_QUANTITY_THOUSANDTHS
    ) {
      fail(
        "invalid_quantity",
        `Kuantitas pada baris ${index + 1} harus lebih dari nol dan maksimal 999.999.999,999.`,
      );
    }
    if (
      typeof line.unit !== "string" ||
      line.unit.trim().length === 0 ||
      line.unit.trim().length > 24
    ) {
      fail("invalid_unit", `Satuan pada baris ${index + 1} wajib diisi dan maksimal 24 karakter.`);
    }
    const unitPriceRupiah = checkedRupiah(
      line.unitPriceRupiah,
      `Harga satuan pada baris ${index + 1}`,
    );
    const lineTotalRupiah = roundRatio(
      line.quantityThousandths * unitPriceRupiah,
      QUANTITY_SCALE,
      "half-away-from-zero",
    );
    if (lineTotalRupiah > MAX_RUPIAH) {
      fail("calculation_overflow", `Total baris ${index + 1} melampaui batas Rupiah.`);
    }
    return {
      description: line.description.trim(),
      quantityThousandths: line.quantityThousandths,
      unit: line.unit.trim(),
      unitPriceRupiah,
      lineTotalRupiah,
    };
  });

  const subtotalRupiah = lines.reduce((subtotal, line, index) => {
    const next = subtotal + line.lineTotalRupiah;
    if (next > MAX_RUPIAH) {
      fail("calculation_overflow", `Subtotal melampaui batas Rupiah setelah baris ${index + 1}.`);
    }
    return next;
  }, 0n);
  checkedRupiah(input.discountRupiah, "Diskon");
  if (input.discountRupiah > subtotalRupiah) {
    fail("discount_exceeds_subtotal", "Diskon tidak boleh melebihi subtotal item.");
  }

  const totalRupiah = subtotalRupiah - input.discountRupiah;
  const itemSteps = lines.map((line, index) => ({
    key: `item-${index + 1}`,
    label: `Total baris ${index + 1}`,
    formula: `${line.quantityThousandths.toString()}/1000 × Rp ${line.unitPriceRupiah.toString()}; dibulatkan ke Rupiah terdekat`,
    resultRupiah: line.lineTotalRupiah,
  }));

  return {
    method: {
      key: INVOICE_METHOD_KEY,
      version: INVOICE_METHOD_VERSION,
    },
    documentType: input.documentType,
    documentNumber: input.documentNumber.trim(),
    issueDate: input.issueDate,
    sellerName: input.sellerName.trim(),
    recipientName: input.recipientName.trim(),
    lines,
    subtotalRupiah,
    discountRupiah: input.discountRupiah,
    totalRupiah,
    steps: [
      ...itemSteps,
      {
        key: "subtotal",
        label: "Subtotal",
        formula: "Jumlah total setiap baris item setelah pembulatan per baris.",
        resultRupiah: subtotalRupiah,
      },
      {
        key: "discount",
        label: "Diskon",
        formula: "Diskon nominal yang dimasukkan pengguna.",
        resultRupiah: input.discountRupiah,
      },
      {
        key: "total",
        label: "Total dokumen",
        formula: "Subtotal − diskon.",
        resultRupiah: totalRupiah,
      },
    ],
    assumptions: [
      "Kuantitas mendukung paling banyak tiga angka desimal; harga satuan memakai Rupiah utuh.",
      "Setiap total baris dihitung eksak lalu dibulatkan ke Rupiah terdekat; tepat setengah dibulatkan menjauhi nol.",
      "Subtotal adalah jumlah total baris yang sudah dibulatkan; diskon adalah nominal tetap yang dimasukkan pengguna.",
      "Perhitungan bersifat lokal, deterministik, dan tidak menyimpan dokumen.",
    ],
    warnings: [
      "Pajak, PPN, pemotongan, dan bea meterai tidak dihitung; total ini tidak menyiratkan kewajiban pajak bernilai nol.",
      "Template umum ini bukan faktur pajak dan bukan nasihat hukum atau perpajakan.",
    ],
    rounding: {
      mode: "half-away-from-zero",
      precision: "Rupiah utuh",
      appliedAt: "setiap baris item",
      description:
        "Jumlah kuantitas × harga satuan dibulatkan per baris ke Rupiah terdekat; nilai tepat setengah dibulatkan menjauhi nol.",
    },
  };
}
