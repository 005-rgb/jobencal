import { Pool } from "pg";
import type { AppEnv } from "../config/env.js";

export function createDatabasePool(env: AppEnv): Pool {
  return new Pool({
    connectionString: env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    statement_timeout: 5_000,
    application_name: "jobenapp-api",
  });
}
