import { createApp } from "./app.js";
import { parseEnv } from "./config/env.js";
import { createDatabasePool } from "./db/pool.js";

async function start(): Promise<void> {
  let env;
  try {
    env = parseEnv(process.env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Invalid environment configuration");
    process.exitCode = 1;
    return;
  }

  const pool = createDatabasePool(env);
  try {
    await pool.query("SELECT 1");
  } catch {
    console.error("API startup failed: PostgreSQL is unavailable or DATABASE_URL is invalid.");
    await pool.end();
    process.exitCode = 1;
    return;
  }

  const server = createApp(pool, env.BASE_PATH).listen(env.PORT, "0.0.0.0", () => {
    console.log(`JOBENAPP API listening on port ${env.PORT}`);
  });

  const shutdown = (): void => {
    server.close(() => {
      void pool.end().finally(() => process.exit(0));
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

void start();
