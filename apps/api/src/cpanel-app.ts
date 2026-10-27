import express, { type Express } from "express";
import { fileURLToPath } from "node:url";
import { createApp, type HealthDatabase } from "./app.js";
import type { AppEnv } from "./config/env.js";

const builtSiteDirectory = fileURLToPath(new URL("../../web/dist/", import.meta.url));

export function createCpanelApp(
  database: HealthDatabase,
  env: Pick<AppEnv, "BASE_PATH" | "ADS_ENABLED">,
  siteDirectory = builtSiteDirectory,
): Express {
  const app = createApp(database, env.BASE_PATH, {
    adsEnabled: env.ADS_ENABLED,
  });

  app.use(express.static(siteDirectory, { dotfiles: "deny" }));
  return app;
}
