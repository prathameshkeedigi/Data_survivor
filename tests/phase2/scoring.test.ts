import { scoreQuestion } from "../../server/engine/scoring";
import type { OptionKey } from "../../shared/questions";
import { mulberry32 } from "../../server/sim/rng";

const map = (pairs: [string, OptionKey | null][]) => new Map(pairs);
const many = (prefix: string, n: number, opt: OptionKey) =>
  Array.from({ length: n }, (_, i) => [`${prefix}${i}`, opt] as [string, OptionKey]);

describe("Phase 2 — scoring", () => {
  it("E1: hand-calculated rarity for A×5, B×3, C×2, D×0", () => {
    const r = scoreQuestion(map([...many("a", 5, "A"), ...many("b", 3, "B"), ...many("c", 2, "C")]));
    expect(r.counts).toEqual({ A: 5, B: 3, C: 2, D: 0 });
    expect(r.shares.A).toBeCloseTo(6 / 14, 6);
    expect(r.shares.B).toBeCloseTo(4 / 14, 6);
    expect(r.shares.C).toBeCloseTo(3 / 14, 6);
    expect(r.scores.get("a0")).toBeCloseTo(-Math.log(6 / 14), 6);
    expect(r.scores.get("b0")).toBeCloseTo(-Math.log(4 / 14), 6);
    expect(r.scores.get("c1")).toBeCloseTo(-Math.log(3 / 14), 6);
  });

  it("E2: an option with 0 picks has finite share 1/(n+4); nothing is NaN or Infinity", () => {
    const r = scoreQuestion(map([["x", "A"], ["y", "A"]]));
    expect(r.shares.D).toBeCloseTo(1 / 6, 6);
    for (const v of [...Object.values(r.shares), ...r.scores.values()]) expect(Number.isFinite(v)).toBe(true);
  });

  it("E3: 200 random rooms — scores ≥ 0 and raw shares sum to 1", () => {
    const rand = mulberry32(42);
    for (let room = 0; room < 200; room++) {
      const n = 1 + Math.floor(rand() * 400);
      const answers = map(Array.from({ length: n }, (_, i) => [`p${i}`, "ABCD"[Math.floor(rand() * 4)] as OptionKey]));
      const r = scoreQuestion(answers);
      for (const s of r.scores.values()) expect(s).toBeGreaterThanOrEqual(0);
      const total = Object.values(r.counts).reduce((a, b) => a + b, 0);
      expect(total).toBe(n);
      expect(Object.values(r.counts).reduce((a, c) => a + c / total, 0)).toBeCloseTo(1, 9);
    }
  });

  it("E4: a skipped question scores 0.5 × the average score of those who answered", () => {
    const r = scoreQuestion(map([["a", "A"], ["b", "A"], ["c", "B"], ["skip", null]]));
    const answered = ["a", "b", "c"].map((id) => r.scores.get(id)!);
    const avg = answered.reduce((x, y) => x + y, 0) / 3;
    expect(r.scores.get("skip")).toBeCloseTo(0.5 * avg, 9);
  });

  it("E23: everyone skips — all scores 0, no NaN", () => {
    const r = scoreQuestion(map([["a", null], ["b", null]]));
    expect([...r.scores.values()]).toEqual([0, 0]);
    expect(r.counts).toEqual({ A: 0, B: 0, C: 0, D: 0 });
  });
});
