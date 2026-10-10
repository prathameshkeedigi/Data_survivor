import { setup, goTo, isResults } from "../helpers/setup";
import { computeWrapped } from "../../server/analytics/wrapped";
import { DILEMMA_QUESTIONS, type OptionKey } from "../../shared/questions";
import { start, client, connected, call, waitFor, host, player, hostTo, sleep } from "../helpers/live";

type Row = Record<string, OptionKey | null>;
const allA = (): Row => Object.fromEntries(DILEMMA_QUESTIONS.map((q) => [q.id, "A"]));

describe("Phase 9 — data for the new visuals", () => {
  it("V1: roundDistribution covers everyone active before the lock and marks the cutoff", () => {
    const ctx = setup();
    const ids = Array.from({ length: 10 }, (_, i) => ctx.game.join(`p${i}`).player.id);
    goTo(ctx, isResults(1), (qid) => ids.forEach((id, i) => ctx.game.submitAnswer(id, qid, "ABCD"[i % 4 === 3 ? 3 : i % 2] as OptionKey)));
    expect(ctx.game.lockSurvivors(1, 6).ok).toBe(true);
    const d = ctx.game.roundDistribution(1)!;
    expect(d.scores).toHaveLength(10);
    expect(d.survivorScores).toHaveLength(6);
    expect(d.cutoff).toBe(Math.min(...d.survivorScores));
    expect(ctx.game.roundDistribution(2)).toBeNull(); // not locked yet
  });

  it("V5–V8: Wrapped carries distribution, timeline, tag counts and round comparison", () => {
    const answers = new Map<string, Row>();
    for (let i = 0; i < 9; i++) answers.set(`p${i}`, allA());
    answers.set("me", { ...allA(), q3: "B", q7: "C", q12: null });
    const w = computeWrapped(answers).get("me")!;
    // V5
    const dist = w.rarest!.dist;
    const sum = Object.values(dist).reduce((a, b) => a + b, 0);
    expect(sum).toBeGreaterThanOrEqual(98);
    expect(sum).toBeLessThanOrEqual(102);
    expect(dist[w.rarest!.option]).toBe(w.rarest!.pct);
    // V6
    expect(w.timeline).toHaveLength(12);
    expect(w.timeline.map((t) => t.num)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(w.timeline[2].mark).toBe("against");
    expect(w.timeline[6].mark).toBe("against");
    expect(w.timeline[11].mark).toBe("skip");
    expect(w.timeline.filter((t) => t.mark === "against").length).toBe(w.againstMajority.count);
    // V7
    expect(Object.values(w.tags).reduce((a, b) => a + b, 0)).toBe(w.answered);
    // V8
    expect(w.rounds).toHaveLength(4);
    for (const r of w.rounds) {
      expect(r.room).toBeGreaterThanOrEqual(0);
      expect(r.room).toBeLessThanOrEqual(100);
      if (r.me !== null) expect(r.me).toBeGreaterThanOrEqual(0);
    }
    expect(w.rounds[0].me).toBeLessThan(w.rounds[0].room); // I went against the room in round 1
    const ghost = computeWrapped(new Map<string, Row>([["ghost", {}], ["p", allA()]])).get("ghost")!;
    expect(ghost.rounds.every((r) => r.me === null)).toBe(true);
    expect(JSON.stringify(ghost)).not.toMatch(/NaN|Infinity/);
  });

  it("V2 + V3 + V4: projector histogram and recap; phone result distributions; recap not sent to phones", async () => {
    const srv = await start({ questionMs: 4000 });
    const h = await host(srv.url);
    const scr = client(srv.url);
    await connected(scr);
    await call(scr, "screen:hello");
    const players = await Promise.all(Array.from({ length: 24 }, (_, i) => player(srv.url, `V${i}`)));
    const answer = async (qid: string) => {
      await Promise.all(players.map((p, i) => call(p, "player:answer", { qid, option: "ABCD"[(i * 3 + qid.length) % 4] })));
    };
    // V4: phone result card distribution
    await hostTo(h, (s) => s.type === "results" && s.round === 1, answer);
    const ps = await waitFor(players[0], "state", (d) => d.scene.type === "results" && d.roundCard);
    for (const it of ps.roundCard.items) {
      if (!it.myOption) continue;
      const sum = Object.values(it.dist as Record<string, number>).reduce((a, b) => a + b, 0);
      expect(sum).toBeGreaterThanOrEqual(98);
      expect(sum).toBeLessThanOrEqual(102);
    }
    // V2: survivors histogram on the projector
    await hostTo(h, (s) => s.type === "survivors" && s.round === 1);
    const ss = await waitFor(scr, "state", (d) => d.scene.type === "survivors" && d.survivors?.histogram);
    const hist = ss.survivors.histogram;
    expect(hist.bins).toHaveLength(10);
    expect(hist.kept).toHaveLength(10);
    expect(hist.bins.reduce((a: number, b: number) => a + b, 0)).toBe(24);
    expect(hist.kept.reduce((a: number, b: number) => a + b, 0)).toBe(ss.survivors.kept);
    for (const p of players.slice(0, 5)) expect(JSON.stringify(ss)).not.toContain(p.me.playerId);
    // V3: recap thumbnails on the projector only
    await hostTo(h, (s) => s.type === "recap", answer, { keepAll: true });
    const sr = await waitFor(scr, "state", (d) => d.scene.type === "recap");
    expect(sr.recap).toHaveLength(4);
    await sleep(200);
    const pr = players[1].log.filter((l) => l.ev === "state").at(-1)!.args[0];
    expect(pr.scene.type).toBe("recap");
    expect(pr.recap).toBeUndefined();
    [h, scr, ...players].forEach((s) => s.close());
    await srv.close();
  }, 120_000);
});
