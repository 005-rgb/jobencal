import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";

describe("GET /api/v1/public/monetization", () => {
  it("fails closed by default and returns no private configuration", async () => {
    const response = await request(createApp({ query: vi.fn() })).get(
      "/api/v1/public/monetization",
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ adsEnabled: false });
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("exposes only the explicitly configured public switch", async () => {
    const response = await request(
      createApp({ query: vi.fn() }, "/api", { adsEnabled: true }),
    ).get("/api/v1/public/monetization");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ adsEnabled: true });
    expect(Object.keys(response.body)).toEqual(["adsEnabled"]);
  });
});

describe("GET /api/v1/health", () => {
  it("returns healthy only after a database query succeeds", async () => {
    const database = { query: vi.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] }) };
    const response = await request(createApp(database)).get("/api/v1/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", db: "ok" });
    expect(database.query).toHaveBeenCalledWith("SELECT 1");
  });

  it("also supports Passenger stripping the configured mount path", async () => {
    const database = { query: vi.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] }) };
    const response = await request(createApp(database, "/jobenapp/api")).get("/v1/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", db: "ok" });
  });

  it("returns a sanitized 503 when PostgreSQL is unavailable", async () => {
    const database = { query: vi.fn().mockRejectedValue(new Error("private connection detail")) };
    const response = await request(createApp(database)).get("/api/v1/health");
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: "error", db: "unavailable" });
    expect(JSON.stringify(response.body)).not.toContain("private connection detail");
  });
});
