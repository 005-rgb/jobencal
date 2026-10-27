export const SITE_ORIGIN = "https://jobenapp.cloud";

export function canonicalUrl(path: string): string {
  const normalizedPath =
    path === "/" ? "/" : `/${path.replace(/^\/+|\/+$/g, "")}/`;

  return new URL(normalizedPath, SITE_ORIGIN).toString();
}
