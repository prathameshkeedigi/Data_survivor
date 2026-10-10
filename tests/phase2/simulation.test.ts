import { simulateAudience, SCENARIOS } from "../../server/sim/audience";
import { runSimulatedGame } from "../../server/sim/driver";

describe("Phase 2 — simulation", () => {
  it("simulateAudience is deterministic per seed and covers every scenario", () => {
    for (const s of SCENARIOS) {
      const a = simulateAudience(60, s, 7);
      expect(a.players).toHaveLength(60);
      expect(simulateAudience(60, s, 7)).toEqual(a);
    }
  });

  it("E25: 1,000 games each at n=150 and n=400 — finalists = min(20, active), winners = min(10, finalists)", () => {
    for (const n of [150, 400]) {
      for (let seed = 1; seed <= 1000; seed++) {
        const scenario = SCENARIOS[seed % SCENARIOS.length];
        const r = runSimulatedGame(simulateAudience(n, scenario, seed), seed);
        expect(r.finalists).toBe(Math.min(20, r.activeBeforeRound4));
        expect(r.winners).toBe(Math.min(10, r.finalists));
      }
    }
  });

  it("E26: sneaky vs random bot — report survival to the finale", () => {
    let sneaky = 0;
    let random = 0;
    const GAMES = 1000;
    for (let seed = 1; seed <= GAMES; seed++) {
      const r = runSimulatedGame(simulateAudience(150, "hidden_groups", seed, { bots: true }), seed);
      if (r.finalistIds.includes("bot_sneaky")) sneaky++;
      if (r.finalistIds.includes("bot_random")) random++;
    }
    const pct = (x: number) => ((100 * x) / GAMES).toFixed(1);
    console.log(
      `E26 REPORT (n=150 + 2 bots, ${GAMES} games): sneaky bot reached the finale ${pct(sneaky)}%, ` +
        `random bot ${pct(random)}%, an average player ${((100 * 20) / 152).toFixed(1)}%`,
    );
    expect(sneaky + random).toBeGreaterThanOrEqual(0); // report only
  });
});
