import express from "express";
export function createApp(database, basePath = "/api", config = {}) {
    const app = express();
    const api = express.Router();
    app.disable("x-powered-by");
    api.get("/v1/public/monetization", (_request, response) => {
        response.setHeader("Cache-Control", "no-store");
        response.json({ adsEnabled: config.adsEnabled === true });
    });
    api.get("/v1/health", async (_request, response) => {
        try {
            await database.query("SELECT 1");
            response.status(200).json({ status: "ok", db: "ok" });
        }
        catch {
            response.status(503).json({ status: "error", db: "unavailable" });
        }
    });
    // Passenger may strip the app's mount path before forwarding a request.
    // Mount both forms so `/api/v1/*` works locally and `/v1/*` works if stripped.
    app.use(basePath, api);
    app.use(api);
    return app;
}
