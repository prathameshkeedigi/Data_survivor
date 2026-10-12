import { spreadMoment, patternMoment, groupsMoment, predictionMoment, MIN_N } from "../../server/analytics/moments";
import { simulateAudience, SCENARIOS } from "../../server/sim/audience";
import { DILEMMA_QUESTIONS, type OptionKey } from "../../shared/questions";
import { start, client, connected, call, host, player, hostTo, sleep } from "../helpers/live";

type Answers = Map<string, Record<string, OptionKey | null>>;

function fromSim(n: number, scenario: (typeof SCENARIOS)[number], seed = 1): Answers {
  const a = simulateAudience(n, scenario, seed);
  return new Map(a.players.map((p) => [p.id, Object.fromEntries(DILEMMA_QUESTIONS.map((q) => [q.id, p.answers[q.id].option]))]));
}

const allFour = (ans: Answers) => [spreadMoment(ans, 1), patternMoment(ans, 2, 1), groupsMoment(ans, 3, 1), predictionMoment(ans, "q12", 4)];

describe("Phase 10 — small rooms", () => {
  it("S1: every moment needs only 5 people; rooms of 1–4 get the plain fallback", () => {
    expect(MIN_N).toEqual({ spread: 5, pattern: 5, groups: 5, prediction: 5 });
    for (let n = 1; n <= 4; n++) for (const m of allFour(fromSim(n, "even"))) expect(m.kind).toBe("too_few");
  });

  it("S2: rooms of 5–60, every scenario — all four moments and every personal card compute cleanly", () => {
    for (const s of SCENARIOS) {
      for (let n = 5; n <= 60; n++) {
        const ans = fromSim(n, s, n);
        for (const m of allFour(ans)) {
          // Only allowed when fewer than 5 actually answered (e.g. simulated players skipped Q12)
          if (m.kind === "too_few") {
            expect(m.n).toBeLessThan(5);
            continue;
          }
          const json = JSON.stringify(m);
          expect(json).not.toMatch(/NaN|Infinity/);
          expect(json).not.toMatch(/sim0\d{3}/);
          const card = (m as any)._private.card as (id: string) => unknown;
          for (const id of ans.keys()) expect(JSON.stringify(card(id))).not.toMatch(/NaN|Infinity/);
        }
      }
    }
  }, 120_000);

  it("S3: a live game with 20 players shows all four moments and gives everyone a Wrapped", async () => {
    const srv = await start({ questionMs: 4000 });
    const h = await host(srv.url);
    const scr = client(srv.url);
    await connected(scr);
    await call(scr, "screen:hello");
    const players = await Promise.all(Array.from({ length: 20 }, (_, i) => player(srv.url, `S${i}`)));
    const opts = ["A", "B", "C", "D"];
    await hostTo(h, (s) => s.type === "wrapped", async (qid) => {
      await Promise.all(players.map((p, i) => call(p, "player:answer", { qid, option: opts[(i * (qid.length + 5) + (i % 3)) % 4] })));
    });
    await sleep(300);
    const kinds = scr.log.filter((l) => l.ev === "state" && l.args[0].scene.type === "moment" && l.args[0].moment).map((l) => l.args[0].moment.kind);
    expect(kinds).toEqual(expect.arrayContaining(["spread", "pattern", "groups", "prediction"]));
    expect(kinds).not.toContain("too_few");
    for (const p of players) {
      const w = p.log.filter((l) => l.ev === "state").at(-1)?.args[0].wrapped;
      expect(w).toBeTruthy();
      expect(JSON.stringify(w)).not.toMatch(/NaN|Infinity/);
    }
    [h, scr, ...players].forEach((s) => s.close());
    await srv.close();
  }, 120_000);
});
