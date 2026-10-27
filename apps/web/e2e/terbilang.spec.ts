import { expect, test } from "@playwright/test";

test("converts Indonesian number text locally at 320px and gates the result and download", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    requests.push(`${request.url()} ${request.postData() ?? ""}`);
  });
  await page.route("**/api/v1/public/monetization", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ adsEnabled: false }),
    });
  });
  await page.setViewportSize({ width: 320, height: 840 });
  await page.goto("/modul/terbilang");

  const rejectOptionalCookies = page.getByRole("button", {
    name: "Tolak opsional",
  });
  if (await rejectOptionalCookies.count()) await rejectOptionalCookies.click();

  await page
    .getByRole("textbox", { name: /Angka yang akan diubah/ })
    .fill("1.234,50");
  await page
    .getByRole("button", { name: "Ubah menjadi terbilang" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hasil siap dihitung" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hasil terbilang" })).toHaveCount(0);

  await page.getByRole("button", { name: "Lihat hasil" }).click();
  await expect(page.getByText("seribu dua ratus tiga puluh empat koma lima nol")).toBeVisible();

  await page.getByRole("button", { name: "Unduh .txt" }).click();
  await expect(page.locator('[data-slot="download-gate"]')).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Lanjutkan unduhan" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("terbilang-123450.txt");

  const dimensions = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(dimensions.body).toBeLessThanOrEqual(320);
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);

  const requestLog = requests.join("\n");
  expect(requestLog).not.toContain("1234");
  expect(requestLog).not.toContain("123450");
  expect(requestLog).not.toContain("seribu dua ratus tiga puluh empat");
});
