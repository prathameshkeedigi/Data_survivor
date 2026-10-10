// Screenshots every projector scene (16:9 and 4:3) while a game runs.
//   node scripts/capture-screen.mjs http://127.0.0.1:3000 out-dir
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const url = process.argv[2] ?? "http://127.0.0.1:3000";
const out = process.argv[3] ?? "test-results/capture";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const pages = [];
for (const [w, h] of [[1920, 1080], [1024, 768]]) {
  const p = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
  await p.goto(`${url}/screen`);
  pages.push({ p, tag: `${w}x${h}` });
}
const seen = new Set();
const stopAt = Date.now() + 20 * 60_000;
while (Date.now() < stopAt) {
  const sceneAttr = await pages[0].p.locator("[data-scene]").first().getAttribute("data-scene").catch(() => null);
  const heading = await pages[0].p.locator("h1").first().textContent().catch(() => "");
  const key = `${sceneAttr}-${(heading ?? "").slice(0, 24)}`;
  if (sceneAttr && !seen.has(key)) {
    seen.add(key);
    await pages[0].p.waitForTimeout(2600); // let animations finish
    const n = String(seen.size).padStart(2, "0");
    for (const { p, tag } of pages) await p.screenshot({ path: `${out}/${n}-${sceneAttr}-${tag}.png` });
    console.log("captured", n, key);
  }
  if (sceneAttr === "wrapped") break;
  await pages[0].p.waitForTimeout(300);
}
await browser.close();
