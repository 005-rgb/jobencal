import express, { type Express } from "express";

export interface HealthDatabase {
  query: (text: string) => Promise<unknown>;
}

export function createApp(database: HealthDatabase): Express {
  const app = express();
  app.disable("x-powered-by");
  app.get("/api/v1/health", async (_request, response) => {
    try {
      await database.query("SELECT 1");
      response.status(200).json({ status: "ok", db: "ok" });
    } catch {
      response.status(503).json({ status: "error", db: "unavailable" });
    }
  });
  return app;
}
