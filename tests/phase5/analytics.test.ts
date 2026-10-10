import { spreadMoment, patternMoment, groupsMoment, predictionMoment, splitLabel, MIN_N } from "../../server/analytics/moments";
import { simulateAudience, SCENARIOS } from "../../server/sim/audience";
import { DILEMMA_QUESTIONS, type OptionKey } from "../../shared/questions";
import { mulberry32 } from "../../server/sim/rng";

type Answers = Map<string, Record<string, OptionKey | null>>;

/** Build an answers table from the simulator (all 12 dilemma questions). */
function fromSim(n: number, scenario: (typeof SCENARIOS)[number], seed = 1): Answers {
  const a = simulateAudience(n, scenario, seed);
  return new Map(a.players.map((p) => [p.id, Object.fromEntries(DILEMMA_QUESTIONS.map((q) => [q.id, p.answers[q.id].option]))]));
}

function table(rows: Record<string, OptionKey | null>[]): Answers {
  return new Map(rows.map((r, i) => [`p${i}`, r]));
}

describe("Phase 5 — analytics", () => {
  it("A1: spread — shares sum to 100% and split labels fire at the right thresholds", () => {
    const ans = fromSim(150, "favourite");
    const m = spreadMoment(ans, 1);
    expect(m.kind).toBe("spread");
    for (const q of m.questions) {
      const sum = Object.values(q.pct).reduce((a, b) => a + b, 0);
      expect(sum).toBeGreaterThanOrEqual(99);
      expect(sum).toBeLessThanOrEqual(101);
    }
    expect(splitLabel([25, 25, 25, 25])).toBe("near-even split");
    expect(splitLabel([40, 30, 20, 10])).toBe("leaning one way");
    expect(splitLabel([70, 10, 10, 10])).toBe("strong favourite");
  });

  it("A2: patterns — lift matches a hand-checked table; random data says no strong pattern", () => {
    // 40 people: 20 chose A on q4 and D on q6; 20 chose B on q4 and C on q6.
    const rows: Record<string, OptionKey>[] = [];
    for (let i = 0; i < 20; i++) rows.push({ q4: "A", q6: "D" });
    for (let i = 0; i < 20; i++) rows.push({ q4: "B", q6: "C" });
    const m = patternMoment(table(rows), 2, 1);
    expect(m.kind).toBe("pattern");
    if (m.kind !== "pattern" || !m.best) throw new Error("expected a pattern");
    // P(q6=D | q4=A) = 1 ; P(q6=D) = 20/40 → "2× as likely"
    const best = m.best;
    expect([best.qa, best.qb].sort()).toEqual(["q4", "q6"]);
    expect(best.lift).toBeCloseTo(2, 6);
    expect(best.countBoth).toBe(20);
    expect(best.likelyReal).toBe(true);
    const random = patternMoment(fromSim(150, "even", 3), 2, 1);
    expect(random.kind === "pattern" && random.best && random.best.likelyReal).toBeFalsy();
  });

  it("A2b: patterns never report a combination with fewer than 5 people", () => {
    for (const s of SCENARIOS) {
      const m = patternMoment(fromSim(60, s, 5), 2, 1);
      if (m.kind === "pattern" && m.best) expect(m.best.countBoth).toBeGreaterThanOrEqual(5);
    }
  });

  it("A3: groups — same seed gives the same map; 2–4 groups or 'no clear groups'; small groups unlabelled", () => {
    const ans = fromSim(150, "hidden_groups", 2);
    const m1 = groupsMoment(ans, 3, 42);
    const m2 = groupsMoment(ans, 3, 42);
    expect(m1).toEqual(m2);
    if (m1.kind !== "groups") throw new Error("expected groups");
    expect(m1.points).toHaveLength(150);
    for (const p of m1.points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
    }
    expect(m1.groups.length === 0 || (m1.groups.length >= 2 && m1.groups.length <= 4)).toBe(true);
    for (const g of m1.groups) if (g.size < 5) expect(g.label).toBeNull();
    // structured data should find groups
    expect(m1.groups.length).toBeGreaterThanOrEqual(2);
  });

  it("A4: prediction never uses a person's own answer (leave-one-out) and the lazy baseline is right", () => {
    // Earlier answers and q12 are independent random draws: there is nothing to learn.
    // A model that peeked at a person's own q12 would score ~100%; an honest one ~25%.
    // Checked over 100 random rooms: no leak (smart ≈ chance) and false "it learned something" alarms ≤ 10%.
    const keys: OptionKey[] = ["A", "B", "C", "D"];
    const randomRoom = (seed: number) => {
      const rand = mulberry32(seed * 31);
      const rows: Record<string, OptionKey>[] = [];
      for (let i = 0; i < 200; i++) {
        const r: Record<string, OptionKey> = {};
        DILEMMA_QUESTIONS.slice(0, 11).forEach((q) => (r[q.id] = keys[Math.floor(rand() * 4)]));
        r.q12 = keys[Math.floor(rand() * 4)];
        rows.push(r);
      }
      return rows;
    };
    let alarms = 0;
    let smartSum = 0;
    let lazySum = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const r = predictionMoment(table(randomRoom(seed)), "q12", 4, seed);
      if (r.kind !== "prediction") throw new Error("expected prediction");
      expect(r.smartPct).toBeLessThan(45);
      if (r.beatsLazy) alarms++;
      smartSum += r.smartPct;
      lazySum += r.lazyPct;
    }
    expect(alarms).toBeLessThanOrEqual(10);
    expect(smartSum / 100).toBeLessThan(lazySum / 100 + 3);
    const rows = randomRoom(1);
    const m = predictionMoment(table(rows), "q12", 4);
    if (m.kind !== "prediction") throw new Error("expected prediction");
    // lazy = share of the most common q12 answer
    const counts = { A: 0, B: 0, C: 0, D: 0 } as Record<OptionKey, number>;
    rows.forEach((r) => counts[r.q12]++);
    expect(m.lazyPct).toBe(Math.round((100 * Math.max(...Object.values(counts))) / 200));
    // structured audiences: smart guess should beat lazy
    const s = predictionMoment(fromSim(200, "hidden_groups", 4), "q12", 4);
    if (s.kind !== "prediction") throw new Error("expected prediction");
    expect(s.smartPct).toBeGreaterThan(s.lazyPct);
    expect(s.beatsLazy).toBe(true);
  });

  it("A5: below minimum sample sizes the moment returns a plain fallback", () => {
    expect(spreadMoment(fromSim(MIN_N.spread - 1, "even"), 1).kind).toBe("too_few");
    expect(patternMoment(fromSim(MIN_N.pattern - 1, "even"), 2, 1).kind).toBe("too_few");
    expect(groupsMoment(fromSim(MIN_N.groups - 1, "even"), 3, 1).kind).toBe("too_few");
    expect(predictionMoment(fromSim(MIN_N.prediction - 1, "even"), "q12", 4).kind).toBe("too_few");
  });

  it("A6 + A7: all 6 scenarios × 4 moments produce valid output, all four in under 3 s at n = 500", () => {
    for (const s of SCENARIOS) {
      const ans = fromSim(500, s, 9);
      const t0 = performance.now();
      const out = [spreadMoment(ans, 1), patternMoment(ans, 2, 1), groupsMoment(ans, 3, 1), predictionMoment(ans, "q12", 4)];
      const ms = performance.now() - t0;
      expect(ms).toBeLessThan(3000);
      for (const m of out) {
        expect(m.kind).not.toBe("too_few");
        expect(JSON.stringify(m)).not.toMatch(/NaN|Infinity|null,null/);
      }
    }
  });

  it("A8: moment payloads carry no player IDs", () => {
    const ans = fromSim(100, "hidden_groups", 1);
    const all = JSON.stringify([spreadMoment(ans, 1), patternMoment(ans, 2, 1), groupsMoment(ans, 3, 1), predictionMoment(ans, "q12", 4)]);
    expect(all).not.toMatch(/sim0\d{3}/);
  });

  it("A9: on-screen wording never says 'cause' and always carries n", () => {
    const ans = fromSim(150, "hidden_groups", 1);
    for (const m of [spreadMoment(ans, 1), patternMoment(ans, 2, 1), groupsMoment(ans, 3, 1), predictionMoment(ans, "q12", 4)]) {
      // Only our generated wording is checked; question texts themselves may say "causes".
      const text = JSON.stringify([(m as any).sentence, (m as any).callout]).toLowerCase();
      expect(text).not.toMatch(/caus/);
      expect((m as any).sentence.length).toBeGreaterThan(0);
      expect((m as any).n).toBeGreaterThan(0);
    }
  });
});
