import { useState } from "preact/hooks";
import {
  calculateInvoiceReceipt,
  InvoiceCalculationError,
  type InvoiceDocumentType,
  type InvoiceReceiptCalculation,
  type InvoiceReceiptInput,
} from "@jobenapp/engine";
import { formatRupiah, parseRupiahInput } from "@jobenapp/shared";
import "../styles/invoice-calculator.css";

interface DraftLine {
  readonly id: number;
  readonly description: string;
  readonly quantity: string;
  readonly unit: string;
  readonly unitPrice: string;
}

interface Draft {
  readonly documentType: InvoiceDocumentType;
  readonly documentNumber: string;
  readonly issueDate: string;
  readonly dueDate: string;
  readonly sellerName: string;
  readonly sellerAddress: string;
  readonly sellerContact: string;
  readonly recipientName: string;
  readonly recipientAddress: string;
  readonly lines: readonly DraftLine[];
  readonly discount: string;
  readonly paymentMethod: string;
  readonly signingCity: string;
  readonly signerName: string;
  readonly note: string;
}

const initialDraft: Draft = {
  documentType: "invoice",
  documentNumber: "",
  issueDate: "",
  dueDate: "",
  sellerName: "",
  sellerAddress: "",
  sellerContact: "",
  recipientName: "",
  recipientAddress: "",
  lines: [{ id: 1, description: "", quantity: "1", unit: "unit", unitPrice: "" }],
  discount: "",
  paymentMethod: "",
  signingCity: "",
  signerName: "",
  note: "",
};

function rupiah(value: bigint): string {
  return `Rp ${formatRupiah(value)}`;
}

function parseMoney(value: string, label: string, required = false): bigint {
  const parsed = parseRupiahInput(value);
  if (parsed === null) {
    if (required) throw new Error(`${label} wajib diisi.`);
    return 0n;
  }
  return parsed;
}

function parseQuantity(value: string, label: string): bigint {
  const match = /^(\d{1,9})(?:,(\d{1,3}))?$/.exec(value.trim());
  if (!match) {
    throw new Error(`${label} harus angka positif dengan maksimal tiga desimal, misalnya 1,5.`);
  }
  const quantity =
    BigInt(match[1]!) * 1_000n +
    BigInt((match[2] ?? "").padEnd(3, "0") || "0");
  if (quantity <= 0n || quantity > 999_999_999_999n) {
    throw new Error(`${label} harus lebih dari nol dan maksimal 999.999.999,999.`);
  }
  return quantity;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function displayDate(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function quantityLabel(value: bigint): string {
  const whole = value / 1_000n;
  const fraction = (value % 1_000n).toString().padStart(3, "0").replace(/0+$/, "");
  return fraction ? `${whole.toString()},${fraction}` : whole.toString();
}

function resultSummary(result: InvoiceReceiptCalculation): string {
  const title = result.documentType === "invoice" ? "INVOICE" : "KWITANSI";
  return [
    `JOBENAPP · ${title}`,
    `Nomor: ${result.documentNumber}`,
    `Tanggal: ${displayDate(result.issueDate)}`,
    `Penjual: ${result.sellerName}`,
    `${result.documentType === "invoice" ? "Ditagihkan kepada" : "Diterima dari"}: ${result.recipientName}`,
    ...result.lines.map(
      (line, index) =>
        `${index + 1}. ${line.description} — ${quantityLabel(line.quantityThousandths)} ${line.unit} × ${rupiah(line.unitPriceRupiah)} = ${rupiah(line.lineTotalRupiah)}`,
    ),
    `Subtotal: ${rupiah(result.subtotalRupiah)}`,
    `Diskon: ${rupiah(result.discountRupiah)}`,
    `Total: ${rupiah(result.totalRupiah)}`,
    "Pajak/PPN/pemotongan tidak dihitung. Template umum, bukan faktur pajak.",
    `Metode: ${result.method.key} v${result.method.version}; pembulatan per baris.`,
  ].join("\n");
}

function buildCalculationInput(draft: Draft): InvoiceReceiptInput {
  if (!draft.documentNumber.trim()) throw new Error("Nomor dokumen wajib diisi.");
  if (!draft.issueDate) throw new Error("Tanggal dokumen wajib diisi.");
  if (!validDate(draft.issueDate)) throw new Error("Tanggal dokumen tidak sah.");
  if (
    draft.dueDate &&
    (!validDate(draft.dueDate) || draft.dueDate < draft.issueDate)
  ) {
    throw new Error("Tanggal jatuh tempo harus sah dan tidak mendahului tanggal dokumen.");
  }
  if (!draft.sellerName.trim()) throw new Error("Nama penjual wajib diisi.");
  if (!draft.recipientName.trim()) throw new Error("Nama penerima wajib diisi.");
  if (draft.sellerAddress.length > 200 || draft.recipientAddress.length > 200) {
    throw new Error("Alamat maksimal 200 karakter.");
  }
  if (draft.sellerContact.length > 100) {
    throw new Error("Kontak penjual maksimal 100 karakter.");
  }
  if (draft.note.length > 500) throw new Error("Catatan maksimal 500 karakter.");

  const lines = draft.lines.map((line, index) => ({
    description: line.description.trim(),
    quantityThousandths: parseQuantity(line.quantity, `Kuantitas item ${index + 1}`),
    unit: line.unit.trim(),
    unitPriceRupiah: parseMoney(
      line.unitPrice,
      `Harga satuan item ${index + 1}`,
      true,
    ),
  }));

  return {
    documentType: draft.documentType,
    documentNumber: draft.documentNumber.trim(),
    issueDate: draft.issueDate,
    sellerName: draft.sellerName.trim(),
    recipientName: draft.recipientName.trim(),
    lines,
    discountRupiah: parseMoney(draft.discount, "Diskon"),
  };
}

function TextField({
  id,
  label,
  value,
  required = false,
  maxLength,
  placeholder,
  onInput,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly required?: boolean;
  readonly maxLength?: number;
  readonly placeholder?: string;
  readonly onInput: (value: string) => void;
}) {
  return (
    <label class="invoice-field" for={id}>
      <span>{label}{required && <span aria-hidden="true"> *</span>}</span>
      <input
        id={id}
        name={id}
        type="text"
        value={value}
        maxLength={maxLength}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        onInput={(event) => onInput(event.currentTarget.value)}
      />
    </label>
  );
}

function MoneyField({
  id,
  label,
  value,
  required = false,
  placeholder = "0",
  onInput,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly required?: boolean;
  readonly placeholder?: string;
  readonly onInput: (value: string) => void;
}) {
  return (
    <label class="invoice-field" for={id}>
      <span>{label}{required && <span aria-hidden="true"> *</span>}</span>
      <span class="invoice-money-input">
        <span aria-hidden="true">Rp</span>
        <input
          id={id}
          name={id}
          type="text"
          inputMode="numeric"
          value={value}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          onInput={(event) => onInput(event.currentTarget.value)}
        />
      </span>
    </label>
  );
}

export default function InvoiceCalculator() {
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [result, setResult] = useState<InvoiceReceiptCalculation | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [nextLineId, setNextLineId] = useState(2);

  function updateDraft(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setResult(null);
    setError("");
    setNotice("");
  }

  function updateLine(id: number, patch: Partial<DraftLine>) {
    updateDraft({
      lines: draft.lines.map((line) => line.id === id ? { ...line, ...patch } : line),
    });
  }

  function calculate(event: SubmitEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      setResult(calculateInvoiceReceipt(buildCalculationInput(draft)));
    } catch (cause) {
      setResult(null);
      setError(
        cause instanceof InvoiceCalculationError || cause instanceof Error
          ? cause.message
          : "Dokumen tidak dapat dihitung dari input ini.",
      );
    }
  }

  async function copySummary() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(resultSummary(result));
      setNotice("Ringkasan dokumen berhasil disalin.");
    } catch {
      setNotice("Browser tidak mengizinkan penyalinan. Pilih dan salin teks dokumen secara manual.");
    }
  }

  function shareWhatsApp() {
    if (!result) return;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(resultSummary(result))}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  const isInvoice = draft.documentType === "invoice";

  return (
    <div class="invoice-calculator">
      <div class="invoice-local-note">
        <span aria-hidden="true">i</span>
        <p>
          Dokumen dihitung di browser dan tidak disimpan atau dikirim. Gunakan
          tombol cetak lalu pilih <strong>Simpan sebagai PDF</strong>. Tidak
          ada pajak atau biaya resmi yang ditambahkan.
        </p>
      </div>

      <form class="invoice-form" onSubmit={calculate} noValidate>
        <fieldset class="invoice-section">
          <legend>Jenis dokumen</legend>
          <div class="invoice-type-options">
            <label>
              <input
                type="radio"
                name="invoice-document-type"
                value="invoice"
                checked={isInvoice}
                onChange={() => updateDraft({ documentType: "invoice" })}
              />
              <span><strong>Invoice</strong><small>Permintaan pembayaran</small></span>
            </label>
            <label>
              <input
                type="radio"
                name="invoice-document-type"
                value="receipt"
                checked={!isInvoice}
                onChange={() => updateDraft({ documentType: "receipt" })}
              />
              <span><strong>Kwitansi</strong><small>Bukti penerimaan pembayaran</small></span>
            </label>
          </div>
        </fieldset>

        <fieldset class="invoice-section">
          <legend>Informasi dokumen</legend>
          <div class="invoice-form-grid">
            <TextField
              id="invoice-number"
              label="Nomor dokumen"
              value={draft.documentNumber}
              required
              maxLength={50}
              placeholder={isInvoice ? "INV-2026-001" : "KW-2026-001"}
              onInput={(documentNumber) => updateDraft({ documentNumber })}
            />
            <label class="invoice-field" for="invoice-date">
              <span>Tanggal dokumen <span aria-hidden="true">*</span></span>
              <input
                id="invoice-date"
                name="invoice-date"
                type="date"
                value={draft.issueDate}
                required
                onInput={(event) => updateDraft({ issueDate: event.currentTarget.value })}
              />
            </label>
            {isInvoice && (
              <label class="invoice-field" for="invoice-due-date">
                <span>Jatuh tempo <small>(opsional)</small></span>
                <input
                  id="invoice-due-date"
                  name="invoice-due-date"
                  type="date"
                  min={draft.issueDate || undefined}
                  value={draft.dueDate}
                  onInput={(event) => updateDraft({ dueDate: event.currentTarget.value })}
                />
              </label>
            )}
          </div>
        </fieldset>

        <fieldset class="invoice-section">
          <legend>{isInvoice ? "Penjual dan pelanggan" : "Pemberi dan penerima pembayaran"}</legend>
          <div class="invoice-form-grid">
            <TextField
              id="invoice-seller"
              label={isInvoice ? "Nama penjual" : "Nama penerima pembayaran"}
              value={draft.sellerName}
              required
              maxLength={120}
              onInput={(sellerName) => updateDraft({ sellerName })}
            />
            <TextField
              id="invoice-recipient"
              label={isInvoice ? "Ditagihkan kepada" : "Diterima dari"}
              value={draft.recipientName}
              required
              maxLength={120}
              onInput={(recipientName) => updateDraft({ recipientName })}
            />
            <TextField
              id="invoice-seller-address"
              label="Alamat penjual"
              value={draft.sellerAddress}
              maxLength={200}
              onInput={(sellerAddress) => updateDraft({ sellerAddress })}
            />
            <TextField
              id="invoice-recipient-address"
              label="Alamat pelanggan"
              value={draft.recipientAddress}
              maxLength={200}
              onInput={(recipientAddress) => updateDraft({ recipientAddress })}
            />
            <TextField
              id="invoice-seller-contact"
              label="Kontak penjual"
              value={draft.sellerContact}
              maxLength={100}
              onInput={(sellerContact) => updateDraft({ sellerContact })}
            />
            {!isInvoice && (
              <TextField
                id="invoice-payment-method"
                label="Cara pembayaran"
                value={draft.paymentMethod}
                maxLength={100}
                onInput={(paymentMethod) => updateDraft({ paymentMethod })}
              />
            )}
          </div>
        </fieldset>

        <fieldset class="invoice-section">
          <legend>Rincian item</legend>
          <p class="invoice-hint">
            Kuantitas boleh memakai koma desimal hingga tiga digit (contoh 1,25).
            Harga satuan diisi dalam Rupiah utuh.
          </p>
          <div class="invoice-line-list">
            {draft.lines.map((line, index) => (
              <section class="invoice-line-card" key={line.id} aria-label={`Item ${index + 1}`}>
                <div class="invoice-line-heading">
                  <h3>Item {index + 1}</h3>
                  {draft.lines.length > 1 && (
                    <button
                      class="invoice-remove-button"
                      type="button"
                      aria-label={`Hapus item ${index + 1}`}
                      onClick={() => updateDraft({ lines: draft.lines.filter((entry) => entry.id !== line.id) })}
                    >
                      Hapus
                    </button>
                  )}
                </div>
                <div class="invoice-line-grid">
                  <label class="invoice-field invoice-field-wide" for={`invoice-item-${line.id}-description`}>
                    <span>Nama barang atau jasa <span aria-hidden="true">*</span></span>
                    <input
                      id={`invoice-item-${line.id}-description`}
                      type="text"
                      maxLength={200}
                      value={line.description}
                      onInput={(event) => updateLine(line.id, { description: event.currentTarget.value })}
                    />
                  </label>
                  <label class="invoice-field" for={`invoice-item-${line.id}-quantity`}>
                    <span>Kuantitas <span aria-hidden="true">*</span></span>
                    <input
                      id={`invoice-item-${line.id}-quantity`}
                      type="text"
                      inputMode="decimal"
                      value={line.quantity}
                      placeholder="1"
                      onInput={(event) => updateLine(line.id, { quantity: event.currentTarget.value })}
                    />
                  </label>
                  <label class="invoice-field" for={`invoice-item-${line.id}-unit`}>
                    <span>Satuan <span aria-hidden="true">*</span></span>
                    <input
                      id={`invoice-item-${line.id}-unit`}
                      type="text"
                      maxLength={24}
                      value={line.unit}
                      placeholder="pcs"
                      onInput={(event) => updateLine(line.id, { unit: event.currentTarget.value })}
                    />
                  </label>
                  <MoneyField
                    id={`invoice-item-${line.id}-price`}
                    label="Harga satuan"
                    value={line.unitPrice}
                    required
                    onInput={(unitPrice) => updateLine(line.id, { unitPrice })}
                  />
                </div>
              </section>
            ))}
          </div>
          <button
            class="invoice-add-button"
            type="button"
            disabled={draft.lines.length >= 100}
            onClick={() => {
              setNextLineId((id) => id + 1);
              updateDraft({
                lines: [
                  ...draft.lines,
                  { id: nextLineId, description: "", quantity: "1", unit: "unit", unitPrice: "" },
                ],
              });
            }}
          >
            + Tambah item
          </button>
          <div class="invoice-discount-field">
            <MoneyField
              id="invoice-discount"
              label="Diskon nominal (opsional)"
              value={draft.discount}
              onInput={(discount) => updateDraft({ discount })}
            />
            <small>Diskon mengurangi subtotal; tidak ada pajak yang dihitung.</small>
          </div>
        </fieldset>

        {!isInvoice && (
          <fieldset class="invoice-section">
            <legend>Pengesahan kwitansi</legend>
            <div class="invoice-form-grid">
              <TextField
                id="invoice-signing-city"
                label="Kota"
                value={draft.signingCity}
                maxLength={100}
                onInput={(signingCity) => updateDraft({ signingCity })}
              />
              <TextField
                id="invoice-signer"
                label="Nama penanda tangan"
                value={draft.signerName}
                maxLength={120}
                onInput={(signerName) => updateDraft({ signerName })}
              />
            </div>
          </fieldset>
        )}

        <fieldset class="invoice-section">
          <legend>Catatan</legend>
          <label class="invoice-field" for="invoice-note">
            <span>Catatan pada dokumen <small>(opsional)</small></span>
            <textarea
              id="invoice-note"
              name="invoice-note"
              maxLength={500}
              rows={3}
              value={draft.note}
              onInput={(event) => updateDraft({ note: event.currentTarget.value })}
            />
          </label>
        </fieldset>

        {error && <p class="invoice-error" role="alert">{error}</p>}
        <button class="button button-primary invoice-submit" type="submit">
          Buat {isInvoice ? "invoice" : "kwitansi"}
        </button>
      </form>

      {result && (
        <section class="invoice-result" aria-labelledby="invoice-result-title">
          <div class="invoice-result-actions no-print" aria-label="Tindakan dokumen">
            <button type="button" onClick={copySummary}>Salin ringkasan</button>
            <button type="button" onClick={shareWhatsApp}>Bagikan WhatsApp</button>
            <button type="button" onClick={() => window.print()}>Cetak / simpan PDF</button>
          </div>
          <article class="invoice-document" id="invoice-document">
            <header class="invoice-document-header">
              <div>
                <p class="invoice-document-brand">JOBENAPP · DOKUMEN UMUM</p>
                <h2 id="invoice-result-title">{result.documentType === "invoice" ? "INVOICE" : "KWITANSI"}</h2>
              </div>
              <dl class="invoice-document-meta">
                <div><dt>Nomor</dt><dd>{result.documentNumber}</dd></div>
                <div><dt>Tanggal</dt><dd>{displayDate(result.issueDate)}</dd></div>
                {isInvoice && draft.dueDate && (
                  <div><dt>Jatuh tempo</dt><dd>{displayDate(draft.dueDate)}</dd></div>
                )}
              </dl>
            </header>

            <section class="invoice-parties">
              <div>
                <h3>{result.documentType === "invoice" ? "Dari" : "Diterima oleh"}</h3>
                <strong>{result.sellerName}</strong>
                {draft.sellerAddress && <p>{draft.sellerAddress}</p>}
                {draft.sellerContact && <p>{draft.sellerContact}</p>}
              </div>
              <div>
                <h3>{result.documentType === "invoice" ? "Ditagihkan kepada" : "Diterima dari"}</h3>
                <strong>{result.recipientName}</strong>
                {draft.recipientAddress && <p>{draft.recipientAddress}</p>}
              </div>
            </section>

            {result.documentType === "receipt" && (
              <p class="invoice-receipt-statement">
                Telah diterima pembayaran dari <strong>{result.recipientName}</strong>
                {draft.paymentMethod && <> melalui <strong>{draft.paymentMethod}</strong></>}.
              </p>
            )}

            <div class="invoice-table-wrap">
              <table class="invoice-document-table">
                <thead>
                  <tr><th>No.</th><th>Deskripsi</th><th>Kuantitas</th><th>Harga satuan</th><th>Jumlah</th></tr>
                </thead>
                <tbody>
                  {result.lines.map((line, index) => (
                    <tr key={`${line.description}-${index}`}>
                      <td>{index + 1}</td>
                      <td>{line.description}</td>
                      <td>{quantityLabel(line.quantityThousandths)} {line.unit}</td>
                      <td>{rupiah(line.unitPriceRupiah)}</td>
                      <td>{rupiah(line.lineTotalRupiah)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl class="invoice-totals">
              <div><dt>Subtotal</dt><dd>{rupiah(result.subtotalRupiah)}</dd></div>
              <div><dt>Diskon</dt><dd>− {rupiah(result.discountRupiah)}</dd></div>
              <div class="invoice-total"><dt>Total {result.documentType === "receipt" ? "diterima" : "tagihan"}</dt><dd>{rupiah(result.totalRupiah)}</dd></div>
            </dl>

            {draft.note.trim() && (
              <section class="invoice-document-note">
                <h3>Catatan</h3>
                <p>{draft.note.trim()}</p>
              </section>
            )}

            {result.documentType === "receipt" && (
              <div class="invoice-signature">
                <p>{draft.signingCity && `${draft.signingCity}, `}{displayDate(result.issueDate)}</p>
                <p>{result.sellerName}</p>
                <div class="invoice-signature-space" aria-hidden="true"></div>
                <strong>{draft.signerName || result.sellerName}</strong>
              </div>
            )}

            <footer class="invoice-document-footnote">
              <p>{result.rounding.description}</p>
              <p>Pajak, PPN, pemotongan, dan bea meterai tidak dihitung.</p>
              <p>Template umum ini bukan faktur pajak atau nasihat hukum/perpajakan.</p>
              <p>Metode {result.method.key} v{result.method.version}</p>
            </footer>
          </article>
          {notice && <p class="invoice-notice no-print" role="status">{notice}</p>}
        </section>
      )}
    </div>
  );
}
