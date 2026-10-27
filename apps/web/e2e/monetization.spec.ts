import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __jobenappClsEntries?: Array<{ value: number; hadRecentInput: boolean }>;
    axe?: {
      run: (context: Element) => Promise<{
        violations: Array<{ id: string; impact: string | null; description: string }>;
      }>;
    };
  }
}

async function stubBackend(page: Page, enabled = false): Promise<void> {
  await page.route("**/api/v1/public/monetization", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ adsEnabled: enabled }),
    });
  });
}

test("keeps placeholders stable and outside the input form at supported widths", async ({
  page,
}) => {
  const widths = [320, 768, 1280];
  await page.addInitScript(() => {
    window.__jobenappClsEntries = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<
        PerformanceEntry & { value: number; hadRecentInput: boolean }
      >) {
        window.__jobenappClsEntries?.push({
          value: entry.value,
          hadRecentInput: entry.hadRecentInput,
        });
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await stubBackend(page);
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/demo-mesin-hitung");
    await expect(page.locator("[data-slot]")).toHaveCount(3);
    await expect(page.locator(".core-form [data-slot]")).toHaveCount(0);
    if (width > 900) {
      await expect(page.locator(".ad-slot-sidebar")).toBeVisible();
    } else {
      await expect(page.locator(".ad-slot-sidebar")).toBeHidden();
    }
    await page.waitForTimeout(700);
    const cls = await page.evaluate(
      () =>
        window.__jobenappClsEntries
          ?.filter((entry) => !entry.hadRecentInput)
          .reduce((total, entry) => total + entry.value, 0) ?? 0,
    );
    expect(cls, `CLS at ${width}px`).toBeLessThanOrEqual(0.1);
  }
});

test("makes no cross-origin request before consent and after rejection", async ({
  page,
}) => {
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== "http://127.0.0.1:5000") {
      externalRequests.push(request.url());
    }
  });
  await stubBackend(page);
  await page.goto("/demo-mesin-hitung");
  await expect(page.getByTestId("consent-banner")).toBeVisible();
  await page.getByRole("button", { name: "Tolak opsional" }).click();
  await expect(page.getByTestId("consent-banner")).toHaveCount(0);
  await page.waitForTimeout(200);
  expect(externalRequests).toEqual([]);
  await expect(page.locator('script[data-jobenapp-ad-script]')).toHaveCount(0);
});

test("keeps calculator input and output out of network requests", async ({
  page,
}) => {
  const seenRequests: string[] = [];
  page.on("request", (request) => {
    seenRequests.push(`${request.url()} ${request.postData() ?? ""}`);
  });
  await stubBackend(page);
  await page.goto("/demo-mesin-hitung");
  await page.getByRole("button", { name: "Terima semua" }).click();
  await page.getByLabel("Nominal dasar").fill("987654321");
  await page.getByLabel("Persentase input").fill("6,75");
  await page.getByRole("button", { name: /Hitung hasil/ }).click();
  await expect(page.locator(".core-error")).toHaveCount(0);
  await expect(page.locator(".core-result-value")).toContainText("66.666.667");
  await page.waitForTimeout(200);
  const requestLog = seenRequests.join("\n");
  expect(requestLog).not.toContain("987654321");
  expect(requestLog).not.toContain("6,75");
  expect(requestLog).not.toContain("66666667");
  await expect(page.locator(".affiliate-slot")).toHaveCount(0);
  await expect(page.locator('script[data-jobenapp-ad-script]')).toHaveCount(0);
});

test("offers equal keyboard-operable consent choices and footer settings", async ({
  page,
}) => {
  await stubBackend(page);
  await page.goto("/");
  const reject = page.getByRole("button", { name: "Tolak opsional" });
  const accept = page.getByRole("button", { name: "Terima semua" });
  await expect(reject).toHaveCSS("min-height", "40px");
  await expect(accept).toHaveCSS("min-height", "40px");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toHaveCount(1);
  await reject.click();
  await page.getByRole("button", { name: "Ubah pilihan cookie" }).click();
  await expect(page.getByTestId("consent-banner")).toBeVisible();
  await expect(page.getByLabel("Analitik")).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: /^Iklan/ })).not.toBeChecked();
});

test("consent banner and ad placeholders have no serious axe violations", async ({
  page,
}) => {
  await stubBackend(page);
  await page.goto("/demo-mesin-hitung");
  const axePath = resolve(process.cwd(), "node_modules/axe-core/axe.min.js");
  test.skip(!existsSync(axePath), "axe-core browser bundle is not installed");
  await page.addScriptTag({ path: axePath });
  const dialog = page.getByTestId("consent-banner");
  const bannerReport = await dialog.evaluate((node) => window.axe?.run(node));
  const slotReport = await page
    .locator(".ad-slot")
    .first()
    .evaluate((node) => window.axe?.run(node));
  const serious = [
    ...(bannerReport?.violations ?? []),
    ...(slotReport?.violations ?? []),
  ].filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );
  expect(serious).toEqual([]);
});

test("home cards open unique module pages through a skippable ad gate", async ({
  page,
}) => {
  await stubBackend(page);
  await page.goto("/");

  const cards = page.locator("a.tool-card");
  await expect(cards).toHaveCount(12);
  await expect(page.locator("main form")).toHaveCount(0);
  const destinations = await cards.evaluateAll((links) =>
    links.map((link) => (link as HTMLAnchorElement).href),
  );
  expect(new Set(destinations).size).toBe(12);
  expect(destinations.every((url) => url.includes("/iklan?tujuan="))).toBe(true);

  await cards.first().click();
  await expect(page).toHaveURL(/\/iklan\?tujuan=%2Fmodul%2Fgaji-bersih$/);
  await expect(
    page.getByRole("heading", { name: "Sebelum membuka Gaji Bersih" }),
  ).toBeVisible();
  await expect(
    page.getByText("Iklan tidak ditampilkan. Anda dapat melanjutkan."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Lanjut ke Gaji Bersih" }).click();
  await expect(page).toHaveURL(/\/modul\/gaji-bersih$/);
  await expect(
    page.getByText("Formulir dan laporan nyata masih dikunci"),
  ).toBeVisible();
  await expect(page.locator("form.payroll-input-form")).toHaveCount(0);
});

test("all twelve module URLs render standalone pages with shipped tools available", async ({
  page,
}) => {
  await stubBackend(page);
  const slugs = [
    "gaji-bersih",
    "pph-21-freelancer",
    "simulasi-kpr",
    "kalkulator-hpp",
    "harga-jual-margin",
    "break-even-point",
    "biaya-marketplace",
    "cicilan-kendaraan",
    "terbilang",
    "kompres-resize-foto-pdf",
    "invoice-kwitansi",
    "kalender-libur",
  ];
  const activeForms: Record<string, string> = {
    "simulasi-kpr": "form.kpr-form",
    "kalkulator-hpp": "form.hpp-form",
    "harga-jual-margin": "form.price-margin-form",
    "break-even-point": "form.bep-form",
    "cicilan-kendaraan": "form.vehicle-form",
    terbilang: "form.terbilang-form",
  };

  for (const slug of slugs) {
    await page.goto(`/modul/${slug}`);
    await expect(page.locator("main h1")).toBeVisible();
    const activeForm = activeForms[slug];
    if (slug === "gaji-bersih") {
      await expect(
        page.getByText("Formulir dan laporan nyata masih dikunci"),
      ).toBeVisible();
      await expect(page.locator("form.payroll-input-form")).toHaveCount(0);
    } else if (activeForm) {
      await expect(page.locator(activeForm)).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Kalkulator belum tersedia" }),
      ).toHaveCount(0);
    } else {
      await expect(
        page.getByRole("heading", { name: "Kalkulator belum tersedia" }),
      ).toBeVisible();
    }
  }
});

test("BEP calculation stays local and shows fractional and whole-unit results", async ({
  page,
}) => {
  const submittedValuesInRequests: string[] = [];
  page.on("request", (request) => {
    const requestText = `${request.url()} ${request.postData() ?? ""}`;
    if (requestText.includes("100000") || requestText.includes("60000")) {
      submittedValuesInRequests.push(requestText);
    }
  });
  await page.goto("/modul/break-even-point");
  const rejectOptionalCookies = page.getByRole("button", {
    name: "Tolak opsional",
  });
  if (await rejectOptionalCookies.isVisible()) {
    await rejectOptionalCookies.click();
  }

  await page.getByLabel(/Biaya tetap untuk periode ini/).fill("100.000");
  await page.getByLabel(/Harga jual per unit/).fill("60.000");
  await page.getByLabel(/Biaya variabel per unit/).fill("20.000");
  await page.getByRole("button", { name: "Hitung titik impas" }).click();

  await expect(page.getByText("5 / 2 unit (≈ 2,5 unit)")).toBeVisible();
  await expect(page.getByText("3 unit")).toBeVisible();
  await expect(page.getByText("Rp 150.000")).toBeVisible();
  await expect(page.getByText("Rp 180.000")).toBeVisible();
  expect(submittedValuesInRequests).toEqual([]);
});
