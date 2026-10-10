import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { ALL_QUESTIONS } from "../../shared/questions";

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? filesUnder(p) : [p];
  });
}

describe("Phase 1 — secrets never reach the browser", () => {
  it("F2a: shared question objects carry no answer/correct field", () => {
    for (const q of ALL_QUESTIONS) {
      const json = JSON.stringify(q).toLowerCase();
      expect(json).not.toMatch(/"(answer|correct|answerkey)"\s*:/);
    }
  });

  it("F2b: no file in web/ imports from server/", () => {
    const offenders = filesUnder("web")
      .filter((f) => /\.(ts|tsx|js|jsx)$/.test(f))
      .filter((f) => /from\s+["'][^"']*server\//.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
