import { createCpanelApp } from "./cpanel-app.js";
import { parseEnv } from "./config/env.js";
import { createDatabasePool } from "./db/pool.js";
async function start() {
    let env;
    try {
        env = parseEnv(process.env);
    }
    catch (error) {
        console.error(error instanceof Error ? error.message : "Invalid environment configuration");
        process.exitCode = 1;
        return;
    }
    if (env.NODE_ENV !== "production") {
        console.error("cPanel startup requires NODE_ENV=production.");
        process.exitCode = 1;
        return;
    }
    const pool = createDatabasePool(env);
    try {
        await pool.query("SELECT 1");
    }
    catch {
        console.error("JOBENAPP startup failed: PostgreSQL is unavailable or DATABASE_URL is invalid.");
        await pool.end();
        process.exitCode = 1;
        return;
    }
    const server = createCpanelApp(pool, env).listen(env.PORT, () => {
        console.log(`JOBENAPP production server listening on Passenger port ${env.PORT}`);
    });
    const shutdown = () => {
        server.close(() => {
            void pool.end().finally(() => process.exit(0));
        });
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
}
void start();
