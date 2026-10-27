import express from "express";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
const builtSiteDirectory = fileURLToPath(new URL("../../web/dist/", import.meta.url));
export function createCpanelApp(database, env, siteDirectory = builtSiteDirectory) {
    const app = createApp(database, env.BASE_PATH, {
        adsEnabled: env.ADS_ENABLED,
    });
    app.use(express.static(siteDirectory, { dotfiles: "deny" }));
    return app;
}
