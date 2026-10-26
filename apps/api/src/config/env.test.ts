import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.js";

describe("parseEnv", () => {
  it("requires a valid PostgreSQL URL without exposing its value", () => {
    expect(() => parseEnv({ DATABASE_URL: undefined })).toThrow("DATABASE_URL");
    expect(() => parseEnv({ DATABASE_URL: "not-a-url" })).toThrow("DATABASE_URL");
  });

  it("uses a validated default port", () => {
    const env = parseEnv({ DATABASE_URL: "postgresql://user:pass@localhost:5432/jobenapp" });
    expect(env.PORT).toBe(3001);
    expect(env.BASE_PATH).toBe("/api");
  });

  it("rejects a port outside the TCP range", () => {
    expect(() =>
      parseEnv({ DATABASE_URL: "postgresql://user:pass@localhost:5432/jobenapp", PORT: "70000" }),
    ).toThrow("PORT");
  });

  it("accepts a nested base path and rejects unsafe forms", () => {
    const url = "postgresql://user:pass@localhost:5432/jobenapp";
    expect(parseEnv({ DATABASE_URL: url, BASE_PATH: "/jobenapp/api" }).BASE_PATH).toBe("/jobenapp/api");
    expect(() => parseEnv({ DATABASE_URL: url, BASE_PATH: "api" })).toThrow("BASE_PATH");
    expect(() => parseEnv({ DATABASE_URL: url, BASE_PATH: "/api/" })).toThrow("BASE_PATH");
  });
});
