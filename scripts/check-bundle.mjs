// F2c + U6: scan the built site for server secrets and enforce the phone bundle budget.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const WEB = "dist/web";
const MARKER = readFileSync("server/finaleKeys.ts", "utf8").match(/SERVER_ONLY_MARKER = "([^"]+)"/)[1];
if (!existsSync(WEB)) {
  console.error("dist/web not found. Run npm run build first.");
  process.exit(1);
}

const files = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? files(join(d, n)) : [join(d, n)]));
let failed = false;

for (const f of files(WEB)) {
  if (readFileSync(f, "utf8").includes(MARKER)) {
    console.error(`F2c FAIL: server-only marker found in ${f}`);
    failed = true;
  }
}

// Phone page = index.html + every asset it references (the screen and host bundles are separate).
const html = readFileSync(join(WEB, "index.html"), "utf8");
const refs = [...html.matchAll(/(?:src|href)="\/?(assets\/[^"]+)"/g)].map((m) => m[1]);
const gz = refs.reduce((sum, r) => sum + gzipSync(readFileSync(join(WEB, r))).length, gzipSync(html).length);
const BUDGET = 150 * 1024;
console.log(`Phone page: ${(gz / 1024).toFixed(1)} KB gzipped (budget ${BUDGET / 1024} KB)`);
if (gz > BUDGET) {
  console.error("U6 FAIL: phone bundle over budget");
  failed = true;
}

if (failed) process.exit(1);
console.log("verify: OK");
