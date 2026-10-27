import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCpanelApp } from "./cpanel-app.js";

describe("cPanel production app", () => {
  let siteDirectory: string;

  beforeEach(async () => {
    siteDirectory = await mkdtemp(join(tmpdir(), "jobenapp-site-"));
    await writeFile(join(siteDirectory, "index.html"), "<main>JOBENAPP production site</main>");
  });

  afterEach(async () => {
    await rm(siteDirectory, { recursive: true, force: true });
  });

  it("serves the built homepage from the root URL", async () => {
    const response = await request(
      createCpanelApp({ query: vi.fn() }, { BASE_PATH: "/api", ADS_ENABLED: false }, siteDirectory),
    ).get("/");

    expect(response.status).toBe(200);
    expect(response.text).toContain("JOBENAPP production site");
  });

  it("keeps the API available alongside the static website", async () => {
    const database = { query: vi.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] }) };
    const response = await request(
      createCpanelApp(database, { BASE_PATH: "/api", ADS_ENABLED: false }, siteDirectory),
    ).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", db: "ok" });
  });
});
