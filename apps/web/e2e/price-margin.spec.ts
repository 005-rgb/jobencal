import { expect, test } from "@playwright/test";

test("holds local results behind a skippable gate and fits a 320px screen", async ({
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
  await page.goto("/modul/harga-jual-margin");
  await page.getByRole("button", { name: "Tolak opsional" }).click();

  await page
    .getByRole("textbox", { name: /Biaya dasar \/ HPP per produk/ })
    .fill("100000");
  await page.getByRole("textbox", { name: /Target margin/ }).fill("25");
  await page.getByRole("button", { name: "Hitung harga jual" }).click();

  await expect(page.getByRole("heading", { name: "Hasil siap dihitung" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Harga jual rekomendasi" })).toHaveCount(0);
  await page.getByRole("button", { name: "Lihat hasil" }).click();
  await expect(page.getByRole("heading", { name: "Harga jual rekomendasi" })).toBeVisible();
  await expect(page.getByText("Rp 133.334").first()).toBeVisible();

  const widths = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(widths.body).toBeLessThanOrEqual(320);
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);

  const requestLog = requests.join("\n");
  expect(requestLog).not.toContain("100000");
  expect(requestLog).not.toContain("133334");
  expect(new URL(page.url()).search).toBe("");
});
