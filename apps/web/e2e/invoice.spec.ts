import { expect, test } from "@playwright/test";

test("Fase 1.11 creates a reconciled invoice and prints the visible document", async ({ page }) => {
  const requestBodies: string[] = [];
  page.on("request", (request) => {
    if (request.postData()) requestBodies.push(request.postData()!);
  });
  await page.addInitScript(() => {
    window.print = () => {
      (window as Window & { __jobenPrinted?: boolean }).__jobenPrinted = true;
    };
  });
  await page.goto("/modul/invoice-kwitansi");
  await expect(page.getByRole("heading", { name: "Invoice & Kwitansi" })).toBeVisible();
  await page.getByLabel(/Nomor dokumen/).fill("INV-E2E-01");
  await page.getByLabel(/Tanggal dokumen/).fill("2026-10-27");
  await page.getByLabel(/Nama penjual/).fill("Toko Uji");
  await page.getByLabel(/Ditagihkan kepada/).fill("Pelanggan Uji");
  await page.getByLabel(/Nama barang atau jasa/).fill("Buku");
  await page.getByLabel(/Kuantitas/).fill("2");
  await page.getByLabel(/Satuan/).fill("pcs");
  await page.getByLabel(/Harga satuan/).fill("12.500");
  await page.getByLabel(/Diskon nominal/).fill("500");
  await page.getByRole("button", { name: "Buat invoice" }).click();

  const document = page.locator("#invoice-document");
  await expect(document.getByRole("heading", { name: "INVOICE" })).toBeVisible();
  await expect(document.getByRole("cell", { name: "Rp 25.000" })).toBeVisible();
  await expect(document.locator(".invoice-total dd")).toHaveText("Rp 24.500");
  await expect(document.getByText(/bukan faktur pajak/i)).toBeVisible();
  await expect.poll(async () =>
    page.evaluate(() => (window as Window & { __jobenPrinted?: boolean }).__jobenPrinted ?? false),
  ).toBe(false);
  await page.getByRole("button", { name: "Cetak / simpan PDF" }).click();
  await expect.poll(async () =>
    page.evaluate(() => (window as Window & { __jobenPrinted?: boolean }).__jobenPrinted ?? false),
  ).toBe(true);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".invoice-form")).toBeHidden();
  await expect(document).toBeVisible();
  const pdf = await page.pdf({ format: "A4" });
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdf.byteLength).toBeGreaterThan(1_000);
  expect(requestBodies.join("\n")).not.toContain("Pelanggan Uji");
  expect(requestBodies.join("\n")).not.toContain("INV-E2E-01");
});
