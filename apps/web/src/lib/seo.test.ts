import { describe, expect, it } from "vitest";
import { GET } from "../pages/sitemap.xml";
import { INDEXABLE_TOOL_SLUGS } from "../data/tools";
import { canonicalUrl } from "./seo";

describe("SEO routes", () => {
  it("normalizes canonical URLs to the HTTPS production origin and trailing slash", () => {
    expect(canonicalUrl("/")).toBe("https://jobenapp.cloud/");
    expect(canonicalUrl("/demo-mesin-hitung")).toBe(
      "https://jobenapp.cloud/demo-mesin-hitung/",
    );
    expect(canonicalUrl("modul/terbilang/")).toBe(
      "https://jobenapp.cloud/modul/terbilang/",
    );
  });

  it("publishes a sitemap of unique canonical URLs for indexable pages only", async () => {
    const response = GET();
    const xml = await response.text();
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/xml; charset=utf-8",
    );
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(urls).toHaveLength(2 + INDEXABLE_TOOL_SLUGS.length);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toContain("https://jobenapp.cloud/");
    expect(urls).toContain("https://jobenapp.cloud/demo-mesin-hitung/");

    for (const slug of INDEXABLE_TOOL_SLUGS) {
      expect(urls).toContain(`https://jobenapp.cloud/modul/${slug}/`);
    }

    for (const slug of [
      "gaji-bersih",
      "pph-21-freelancer",
      "biaya-marketplace",
      "kompres-resize-foto-pdf",
      "kalender-libur",
    ]) {
      expect(urls).not.toContain(`https://jobenapp.cloud/modul/${slug}/`);
    }
  });
});
