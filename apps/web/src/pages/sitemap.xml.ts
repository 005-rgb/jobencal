import { isToolIndexable, tools } from "../data/tools";
import { canonicalUrl } from "../lib/seo";

export const prerender = true;

const sitemapUrls = [
  canonicalUrl("/"),
  canonicalUrl("/demo-mesin-hitung"),
  ...tools
    .filter((tool) => isToolIndexable(tool.slug))
    .map((tool) => canonicalUrl(`/modul/${tool.slug}`)),
];

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function GET(): Response {
  const urls = sitemapUrls
    .map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`)
    .join("\n");
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
    "",
  ].join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
