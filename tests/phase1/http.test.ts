import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createHttpApp } from "../../server/app";

let server: Server;
let base: string;

beforeAll(async () => {
  // A fake built site, so this test doesn't depend on running the frontend build.
  const webDir = mkdtempSync(join(tmpdir(), "ds-web-"));
  writeFileSync(join(webDir, "index.html"), "<html>PLAY_PAGE</html>");
  writeFileSync(join(webDir, "screen.html"), "<html>SCREEN_PAGE</html>");
  writeFileSync(join(webDir, "host.html"), "<html>HOST_PAGE</html>");
  const app = createHttpApp({ port: 0, hostPassword: "long-enough-pass", webDir });
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe("Phase 1 — HTTP", () => {
  it("F4a: GET /health returns 200 { ok: true }", async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it("F4b: /, /screen and /host each serve their own page", async () => {
    for (const [path, marker] of [["/", "PLAY_PAGE"], ["/screen", "SCREEN_PAGE"], ["/host", "HOST_PAGE"]]) {
      const res = await fetch(base + path);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toMatch(/text\/html/);
      expect(await res.text()).toContain(marker);
    }
  });

  it("F4c: a missing asset returns 404, not the HTML page", async () => {
    const res = await fetch(`${base}/does-not-exist.js`);
    expect(res.status).toBe(404);
  });
});
