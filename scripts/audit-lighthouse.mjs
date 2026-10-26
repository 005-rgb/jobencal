import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";
import { chromium } from "@playwright/test";

const url = process.env.LIGHTHOUSE_URL ?? "http://127.0.0.1:5000/";
const chrome = await launch({
  chromePath: chromium.executablePath(),
  chromeFlags: [
    "--headless",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
  ],
});

try {
  const report = await lighthouse(
    url,
    {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      onlyCategories: ["performance"],
      formFactor: "mobile",
      screenEmulation: {
        mobile: true,
        width: 390,
        height: 844,
        deviceScaleFactor: 1,
        disabled: false,
      },
    },
    undefined,
  );
  const cls = report?.lhr.audits["cumulative-layout-shift"]?.numericValue;
  console.log(`Lighthouse CLS (${url}): ${String(cls)}`);
  if (typeof cls !== "number" || cls > 0.1) {
    throw new Error("Lighthouse CLS must be at or below 0.1.");
  }
} finally {
  await chrome.kill();
}
