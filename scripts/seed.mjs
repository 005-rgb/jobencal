import { readFile } from "node:fs/promises";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Seed failed: configure DATABASE_URL in the development environment.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 5_000,
});

try {
  const sql = await readFile(new URL("../apps/api/seeds/001_catalog.sql", import.meta.url), "utf8");
  await pool.query(sql);
  console.log("Development catalog seed applied. No rate values were created or published.");
} catch {
  console.error("Seed failed. Confirm migrations are applied and the development database is reachable.");
  process.exitCode = 1;
} finally {
  await pool.end();
}
