import express from "express";
import { join, resolve } from "node:path";
import type { Config } from "./config";

export function createHttpApp(config: Config) {
  const app = express();
  const webDir = resolve(config.webDir);
  app.disable("x-powered-by");

  app.get("/health", (_req, res) => {
    res.json({ ok: true, uptimeSec: Math.round(process.uptime()) });
  });

  // HTML must never be cached, so a fixed deploy is picked up on refresh.
  const page = (file: string) => (_req: express.Request, res: express.Response) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(join(webDir, file));
  };
  app.get("/", page("index.html"));
  app.get("/screen", page("screen.html"));
  app.get("/host", page("host.html"));

  // Hashed assets are immutable, so phones fetch them once.
  app.use(express.static(webDir, { index: false, maxAge: "7d", immutable: true }));
  app.use((_req, res) => {
    res.status(404).send("Not found");
  });
  return app;
}
