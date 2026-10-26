import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.js";

describe("parseEnv", () => {
  it("requires a valid PostgreSQL URL without exposing its value", () => {
    expect(() => parseEnv({ DATABASE_URL: undefined })).toThrow("DATABASE_URL");
    expect(() => parseEnv({ DATABASE_URL: "not-a-url" })).toThrow("DATABASE_URL");
  });

  it("uses a validated default port", () => {
    expect(parseEnv({ DATABASE_URL: "postgresql://user:pass@localhost:5432/jobenapp" }).PORT).toBe(3001);
  });

  it("rejects a port outside the TCP range", () => {
    expect(() =>
      parseEnv({ DATABASE_URL: "postgresql://user:pass@localhost:5432/jobenapp", PORT: "70000" }),
    ).toThrow("PORT");
  });
});
