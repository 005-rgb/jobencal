import { describe, expect, it } from "vitest";
import fixtures from "./fixtures/phase-1-11-invoice-math.json" with {
  type: "json",
};
import {
  calculateInvoiceReceipt,
  INVOICE_METHOD_KEY,
  INVOICE_METHOD_VERSION,
  InvoiceCalculationError,
  type InvoiceCalculationErrorCode,
  type InvoiceLineInput,
  type InvoiceReceiptInput,
} from "./invoice.js";

interface FixtureCase {
  readonly id: string;
  readonly scenario: string;
  readonly documentType: "invoice" | "receipt";
  readonly issueDate?: string;
  readonly lines: readonly {
    readonly description: string;
    readonly quantityThousandths: string;
    readonly unit: string;
    readonly unitPriceRupiah: string;
  }[];
  readonly discountRupiah: string;
  readonly expected?: {
    readonly subtotalRupiah: string;
    readonly totalRupiah: string;
  };
  readonly expectedError?: InvoiceCalculationErrorCode;
}

const validHeader = {
  documentNumber: "INV-2026-001",
  issueDate: "2026-10-27",
  sellerName: "Penjual",
  recipientName: "Penerima",
};

function inputFor(fixture: FixtureCase): InvoiceReceiptInput {
  const lines: InvoiceLineInput[] = fixture.lines.map((line) => ({
    ...line,
    quantityThousandths: BigInt(line.quantityThousandths),
    unitPriceRupiah: BigInt(line.unitPriceRupiah),
  }));
  return {
    ...validHeader,
    documentType: fixture.documentType,
    issueDate: fixture.issueDate ?? validHeader.issueDate,
    lines,
    discountRupiah: BigInt(fixture.discountRupiah),
  };
}

function expectDomainError(
  operation: () => unknown,
  code: InvoiceCalculationErrorCode,
): void {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(InvoiceCalculationError);
    expect((error as InvoiceCalculationError).code).toBe(code);
    return;
  }
  throw new Error(`Expected invoice domain error: ${code}`);
}

describe("Phase 1.11 invoice and receipt arithmetic", () => {
  it("provides at least twelve traceable calculation fixtures", () => {
    expect(fixtures.phase).toBe("1.11");
    expect(fixtures.methodVersion).toBe(INVOICE_METHOD_VERSION);
    expect(fixtures.methodKey).toBe(INVOICE_METHOD_KEY);
    expect(fixtures.cases.length).toBeGreaterThanOrEqual(12);
    expect(fixtures.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fixtures.reviewStatus).toBe("pending_independent_human_review");
    expect(fixtures.reviewer).toBeNull();
  });

  for (const fixture of fixtures.cases as FixtureCase[]) {
    it(`${fixture.id}: ${fixture.scenario}`, () => {
      const input = inputFor(fixture);
      if (fixture.expectedError) {
        expectDomainError(
          () => calculateInvoiceReceipt(input),
          fixture.expectedError,
        );
        return;
      }
      const result = calculateInvoiceReceipt(input);
      expect(result.subtotalRupiah.toString()).toBe(
        fixture.expected?.subtotalRupiah,
      );
      expect(result.totalRupiah.toString()).toBe(fixture.expected?.totalRupiah);
      expect(result.method).toEqual({
        key: INVOICE_METHOD_KEY,
        version: INVOICE_METHOD_VERSION,
      });
      expect(result.warnings.join(" ")).toMatch(/tidak dihitung/i);
    });
  }

  it("rejects invalid identities, numbers, descriptions, quantities, and lines", () => {
    const base = inputFor(fixtures.cases[0] as FixtureCase);
    expectDomainError(
      () => calculateInvoiceReceipt({ ...base, documentNumber: " " }),
      "invalid_document_number",
    );
    expectDomainError(
      () => calculateInvoiceReceipt({ ...base, recipientName: "" }),
      "invalid_identity",
    );
    expectDomainError(
      () => calculateInvoiceReceipt({
        ...base,
        lines: [{ ...base.lines[0]!, description: " " }],
      }),
      "invalid_line_description",
    );
    expectDomainError(
      () => calculateInvoiceReceipt({
        ...base,
        lines: [{ ...base.lines[0]!, quantityThousandths: 0n }],
      }),
      "invalid_quantity",
    );
    expectDomainError(
      () => calculateInvoiceReceipt({ ...base, lines: [] }),
      "invalid_lines",
    );
  });

  it("returns visible reconciliation steps and never silently adds tax", () => {
    const result = calculateInvoiceReceipt(inputFor(fixtures.cases[8] as FixtureCase));
    expect(result.steps.at(-3)?.resultRupiah).toBe(result.subtotalRupiah);
    expect(result.steps.at(-1)?.resultRupiah).toBe(result.totalRupiah);
    expect(result.rounding.appliedAt).toBe("setiap baris item");
    expect(result.warnings.join(" ")).toContain("tidak menyiratkan kewajiban pajak bernilai nol");
  });

  it("rejects negative values and arithmetic overflow", () => {
    const base = inputFor(fixtures.cases[0] as FixtureCase);
    expectDomainError(
      () => calculateInvoiceReceipt({ ...base, discountRupiah: -1n }),
      "invalid_discount",
    );
    expectDomainError(
      () => calculateInvoiceReceipt({
        ...base,
        lines: [
          { ...base.lines[0]!, unitPriceRupiah: 999_999_999_999_999_999n },
          { ...base.lines[0]!, unitPriceRupiah: 1n },
        ],
      }),
      "calculation_overflow",
    );
  });
});
