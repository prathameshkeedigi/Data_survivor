import { setup, goTo, isQ, isResults } from "../helpers/setup";
import { Game } from "../../server/engine/game";
import type { OptionKey } from "../../shared/questions";

describe("Phase 2 — game state", () => {
  it("E11: answers only count for the open question", () => {
    const ctx = setup();
    const p = ctx.game.join("ana").player;
    expect(ctx.game.submitAnswer(p.id, "q1", "A")).toEqual({ ok: false, error: "NOT_OPEN" }); // lobby
    goTo(ctx, isQ("q1"));
    expect(ctx.game.submitAnswer(p.id, "q2", "A")).toEqual({ ok: false, error: "NOT_OPEN" }); // wrong question
    expect(ctx.game.submitAnswer(p.id, "q1", "A").ok).toBe(true);
    ctx.next(); // closes voting
    const p2 = ctx.game.join("ben").player;
    expect(ctx.game.submitAnswer(p2.id, "q1", "B")).toEqual({ ok: false, error: "NOT_OPEN" }); // after close
  });

  it("E12: a second answer is not stored; the first is locked in", () => {
    const ctx = setup();
    const p = ctx.game.join("ana").player;
    goTo(ctx, isQ("q1"));
    expect(ctx.game.submitAnswer(p.id, "q1", "A")).toMatchObject({ ok: true, duplicate: false, option: "A" });
    expect(ctx.game.submitAnswer(p.id, "q1", "B")).toMatchObject({ ok: true, duplicate: true, option: "A" });
    expect(ctx.game.answerOf(p.id, "q1")).toBe("A");
  });

  it("E13: invalid options and unknown players are rejected", () => {
    const ctx = setup();
    const p = ctx.game.join("ana").player;
    goTo(ctx, isQ("q1"));
    for (const bad of ["E", "", null, undefined, 3, "a"]) {
      expect(ctx.game.submitAnswer(p.id, "q1", bad as any)).toEqual({ ok: false, error: "INVALID_OPTION" });
    }
    expect(ctx.game.submitAnswer("nobody", "q1", "A")).toEqual({ ok: false, error: "UNKNOWN_PLAYER" });
  });

  it("E16: joining before round-1 results is active; after is Analyst (late)", () => {
    const ctx = setup();
    const early = ctx.game.join("early").player;
    goTo(ctx, isQ("q3"));
    const duringQ3 = ctx.game.join("q3joiner").player;
    goTo(ctx, isResults(1));
    const late = ctx.game.join("late").player;
    expect(ctx.game.getPlayer(early.id)!.status).toBe("active");
    expect(ctx.game.getPlayer(duringQ3.id)!.status).toBe("active");
    expect(late.status).toBe("late");
  });

  it("E27: advance() while voting is open closes voting without changing scene", () => {
    const ctx = setup();
    ctx.game.join("ana");
    goTo(ctx, isQ("q1"));
    expect(ctx.game.votingOpen).toBe(true);
    expect(ctx.next().ok).toBe(true);
    expect(ctx.game.scene).toEqual({ type: "question", qid: "q1", round: 1 });
    expect(ctx.game.votingOpen).toBe(false);
    expect(ctx.next().ok).toBe(true);
    expect(ctx.game.scene).toEqual({ type: "question", qid: "q2", round: 1 });
  });

  it("E28: tick() closes voting when time runs out; an answer 1 ms late is rejected", () => {
    const ctx = setup();
    const a = ctx.game.join("a").player;
    const b = ctx.game.join("b").player;
    goTo(ctx, isQ("q1"));
    const { closesAt } = ctx.game.voting!;
    ctx.clock.t = closesAt;
    expect(ctx.game.submitAnswer(a.id, "q1", "A").ok).toBe(true); // exactly on time
    ctx.clock.t = closesAt + 1;
    expect(ctx.game.submitAnswer(b.id, "q1", "A")).toEqual({ ok: false, error: "NOT_OPEN" });
    ctx.game.tick();
    expect(ctx.game.votingOpen).toBe(false);
  });

  it("E29: two advances within 600 ms — the second is rejected", () => {
    const ctx = setup();
    ctx.wait(1000);
    expect(ctx.game.advance().ok).toBe(true);
    ctx.wait(100);
    expect(ctx.game.advance()).toEqual({ ok: false, error: "TOO_FAST" });
    expect(ctx.game.back()).toEqual({ ok: false, error: "TOO_FAST" });
    ctx.wait(600);
    expect(ctx.game.advance().ok).toBe(true);
  });

  it("E30: cannot go from results to survivors without locking", () => {
    const ctx = setup();
    ctx.game.join("a");
    goTo(ctx, isResults(1));
    expect(ctx.next()).toEqual({ ok: false, error: "LOCK_REQUIRED" });
    expect(ctx.game.lockSurvivors(1, 1).ok).toBe(true);
    expect(ctx.next().ok).toBe(true);
    expect(ctx.game.scene).toEqual({ type: "survivors", round: 1 });
  });

  it("E31: pause keeps remaining time; answers rejected while paused", () => {
    const ctx = setup();
    const p = ctx.game.join("a").player;
    goTo(ctx, isQ("q1"));
    ctx.wait(5_000);
    expect(ctx.game.msRemaining()).toBe(15_000);
    ctx.game.pause();
    ctx.wait(60_000); // a long pause must not close voting
    expect(ctx.game.votingOpen).toBe(true);
    expect(ctx.game.msRemaining()).toBe(15_000);
    expect(ctx.game.submitAnswer(p.id, "q1", "A")).toEqual({ ok: false, error: "PAUSED" });
    ctx.game.resume();
    ctx.wait(14_000);
    expect(ctx.game.votingOpen).toBe(true);
    expect(ctx.game.submitAnswer(p.id, "q1", "A")).toMatchObject({ ok: true, ms: 19_000 }); // paused time not counted
    ctx.wait(1_001);
    expect(ctx.game.votingOpen).toBe(false);
  });

  it("E17: back() into closed questions / results never reopens or recomputes", () => {
    const ctx = setup();
    const players = ["a", "b", "c", "d"].map((n) => ctx.game.join(n).player);
    goTo(ctx, isResults(1), (qid) => players.forEach((p, i) => ctx.game.submitAnswer(p.id, qid, i % 2 ? "B" : "A")));
    const before = JSON.stringify(ctx.game.roundResults(1));
    expect(ctx.game.lockSurvivors(1, 2).ok).toBe(true);
    const statuses = players.map((p) => ctx.game.getPlayer(p.id)!.status);
    expect(ctx.next().ok).toBe(true); // survivors
    ctx.wait(700);
    expect(ctx.game.back().ok).toBe(true); // results
    ctx.wait(700);
    expect(ctx.game.back().ok).toBe(true); // q3
    expect(ctx.game.scene).toMatchObject({ type: "question", qid: "q3" });
    expect(ctx.game.votingOpen).toBe(false);
    expect(ctx.next().ok).toBe(true); // results
    expect(ctx.next().ok).toBe(true); // survivors (already locked)
    expect(ctx.game.scene).toEqual({ type: "survivors", round: 1 });
    expect(JSON.stringify(ctx.game.roundResults(1))).toBe(before);
    expect(players.map((p) => ctx.game.getPlayer(p.id)!.status)).toEqual(statuses);
  });
});

describe("Phase 2 — ranking & survivors", () => {
  /** Each named player answers every round-1 question with `opt`, `delay` ms after it opens. */
  function roundOne(pattern: Record<string, { opt: OptionKey; delay: number }>) {
    const ctx = setup();
    const ids: Record<string, string> = {};
    for (const name of Object.keys(pattern)) ids[name] = ctx.game.join(name).player.id;
    goTo(ctx, isResults(1), (qid) => {
      const start = ctx.clock.t;
      const order = Object.entries(pattern).sort((a, b) => a[1].delay - b[1].delay);
      for (const [name, { opt, delay }] of order) {
        ctx.clock.t = start + delay;
        ctx.game.submitAnswer(ids[name], qid, opt);
      }
    });
    return { ctx, ids };
  }

  it("E6: equal scores are broken by faster answer time", () => {
    const { ctx, ids } = roundOne({
      slow: { opt: "A", delay: 9_000 },
      fast: { opt: "A", delay: 1_000 },
      other: { opt: "B", delay: 5_000 },
      other2: { opt: "B", delay: 6_000 },
    });
    const ranked = ctx.game.roundRanking(1).ranked.map((r) => r.playerId);
    expect(ranked.indexOf(ids.fast)).toBeLessThan(ranked.indexOf(ids.slow));
    expect(ranked.indexOf(ids.other)).toBeLessThan(ranked.indexOf(ids.other2));
  });

  it("E7: equal score and equal time — ordered by player ID, stable over 100 runs", () => {
    const { ctx } = roundOne({ x: { opt: "A", delay: 1000 }, y: { opt: "A", delay: 1000 }, z: { opt: "A", delay: 1000 } });
    const expected = ctx.game.roundRanking(1).ranked.map((r) => r.playerId);
    expect(expected).toEqual([...expected].sort());
    for (let i = 0; i < 100; i++) expect(ctx.game.roundRanking(1).ranked.map((r) => r.playerId)).toEqual(expected);
  });

  it("E8: keep ≥ active players — everyone survives", () => {
    const { ctx, ids } = roundOne({ a: { opt: "A", delay: 1 }, b: { opt: "B", delay: 2 } });
    expect(ctx.game.lockSurvivors(1, 50).ok).toBe(true);
    for (const id of Object.values(ids)) expect(ctx.game.getPlayer(id)!.status).toBe("active");
  });

  it("E9: keep of 0, negative or non-integer is rejected", () => {
    const { ctx } = roundOne({ a: { opt: "A", delay: 1 } });
    for (const bad of [0, -3, 2.5, NaN]) expect(ctx.game.lockSurvivors(1, bad)).toEqual({ ok: false, error: "INVALID_CUTOFF" });
  });

  it("E10: reports how many players share the cutoff player's exact score", () => {
    const { ctx } = roundOne({
      a: { opt: "A", delay: 1 },
      b: { opt: "A", delay: 2 },
      c: { opt: "A", delay: 3 },
      d: { opt: "B", delay: 4 },
      e: { opt: "C", delay: 5 },
    });
    expect(ctx.game.roundRanking(1, 3).tiedAtCutoff).toBe(3); // a, b, c share a score
    expect(ctx.game.roundRanking(1, 1).tiedAtCutoff).toBe(2); // d and e share a score
  });

  it("E5 + E14 + E15: shares use everyone; only active players are ranked; eliminated never return", () => {
    const ctx = setup();
    const ids = Array.from({ length: 8 }, (_, i) => ctx.game.join(`p${i}`).player.id);
    goTo(ctx, isResults(1), (qid) => ids.forEach((id, i) => ctx.game.submitAnswer(id, qid, i < 4 ? "A" : "B")));
    expect(ctx.game.lockSurvivors(1, 4).ok).toBe(true);
    const eliminated = ids.filter((id) => ctx.game.getPlayer(id)!.status === "eliminated");
    expect(eliminated).toHaveLength(4);
    goTo(ctx, isResults(2), (qid) => ids.forEach((id) => ctx.game.submitAnswer(id, qid, "C")));
    const res = ctx.game.roundResults(2)!;
    expect(res.questions[0].counts.C).toBe(8); // analysts counted (E14)
    expect(res.n).toBe(8);
    const ranked = ctx.game.roundRanking(2).ranked.map((r) => r.playerId);
    expect(ranked).toHaveLength(4);
    for (const id of eliminated) expect(ranked).not.toContain(id);
    expect(ctx.game.lockSurvivors(2, 4).ok).toBe(true);
    for (const id of eliminated) expect(ctx.game.getPlayer(id)!.status).toBe("eliminated"); // E15
  });
});

describe("Phase 2 — finale", () => {
  function toFinale(n: number) {
    const ctx = setup();
    const ids = Array.from({ length: n }, (_, i) => ctx.game.join(`p${i}`).player.id);
    goTo(ctx, (s) => s.type === "finale_intro", (qid) => ids.forEach((id, i) => ctx.game.submitAnswer(id, qid, "ABCD"[i % 4] as OptionKey)), () => n);
    return { ctx, ids };
  }
  const KEY: Record<string, OptionKey> = { f1: "C", f2: "B", f3: "A", tb: "B" };
  const WRONG: Record<string, OptionKey> = { f1: "A", f2: "A", f3: "B", tb: "A" };

  it("E18: correct, then time on correct, then tie-breaker correct, then tie-breaker time", () => {
    const { ctx } = toFinale(6);
    const fins = ctx.game.finalists().map((p) => p.id);
    expect(fins).toHaveLength(6);
    const [allRight, twoFast, twoSlow, tbFast, tbSlow, tbWrong] = fins;
    const two = { f1: true, f2: true, f3: false };
    const plan: Record<string, { right: Record<string, boolean>; delay: number; tbDelay: number }> = {
      [allRight]: { right: { f1: true, f2: true, f3: true, tb: false }, delay: 9000, tbDelay: 9000 },
      [twoFast]: { right: { ...two, tb: false }, delay: 1000, tbDelay: 9000 }, // time 2,000
      [twoSlow]: { right: { ...two, tb: false }, delay: 5000, tbDelay: 1000 }, // time 10,000
      [tbFast]: { right: { ...two, tb: true }, delay: 7000, tbDelay: 8000 }, // time 14,000, tb right
      [tbSlow]: { right: { ...two, tb: true }, delay: 7000, tbDelay: 9000 }, // time 14,000, tb right, slower
      [tbWrong]: { right: { ...two, tb: false }, delay: 7000, tbDelay: 500 }, // time 14,000, tb wrong
    };
    goTo(ctx, (s) => s.type === "finale_results", (qid) => {
      const start = ctx.clock.t;
      const d = (p: (typeof plan)[string]) => (qid === "tb" ? p.tbDelay : p.delay);
      for (const [id, p] of Object.entries(plan).sort((a, b) => d(a[1]) - d(b[1]))) {
        ctx.clock.t = start + d(p);
        ctx.game.submitAnswer(id, qid, p.right[qid] ? KEY[qid] : WRONG[qid]);
      }
    });
    expect(ctx.game.finaleRanking().map((r) => r.playerId)).toEqual([allRight, twoFast, twoSlow, tbFast, tbSlow, tbWrong]);
  });

  it("E19: lockWinners above 20 is rejected", () => {
    const { ctx } = toFinale(3);
    goTo(ctx, (s) => s.type === "finale_results");
    expect(ctx.game.lockWinners(25)).toEqual({ ok: false, error: "INVALID_CUTOFF" });
    expect(ctx.game.lockWinners(2).ok).toBe(true);
    expect(ctx.game.winners()).toHaveLength(2);
  });

  it("E20: analysts can play the finale but are never ranked", () => {
    const { ctx } = toFinale(3);
    const analyst = ctx.game.join("spectator").player;
    expect(analyst.status).toBe("late");
    goTo(ctx, isQ("f1"));
    expect(ctx.game.submitAnswer(analyst.id, "f1", "C").ok).toBe(true);
    goTo(ctx, (s) => s.type === "finale_results");
    expect(ctx.game.finaleRanking().map((r) => r.playerId)).not.toContain(analyst.id);
  });
});

describe("Phase 2 — strange rooms", () => {
  it("E21: a full game with 1 player completes", () => {
    const ctx = setup();
    const p = ctx.game.join("solo").player;
    goTo(ctx, (s) => s.type === "wrapped", (qid) => ctx.game.submitAnswer(p.id, qid, "A"));
    expect(ctx.game.winners().map((w) => w.id)).toEqual([p.id]);
  });

  it("E22: everyone picks the same option — equal scores, ties by time, no NaN", () => {
    const ctx = setup();
    const ids = Array.from({ length: 6 }, (_, i) => ctx.game.join(`p${i}`).player.id);
    const fastestFirst = [...ids].reverse();
    goTo(ctx, isResults(1), (qid) => {
      const start = ctx.clock.t;
      fastestFirst.forEach((id, i) => {
        ctx.clock.t = start + (i + 1) * 100;
        ctx.game.submitAnswer(id, qid, "A");
      });
    });
    const ranked = ctx.game.roundRanking(1).ranked;
    expect(new Set(ranked.map((r) => r.score)).size).toBe(1);
    for (const r of ranked) expect(Number.isFinite(r.score)).toBe(true);
    expect(ranked.map((r) => r.playerId)).toEqual(fastestFirst);
  });

  it("E24: no active players before the finale — 0 finalists, empty winners, no crash", () => {
    const ctx = setup();
    goTo(ctx, isResults(1));
    ctx.game.join("late1");
    ctx.game.join("late2");
    goTo(ctx, (s) => s.type === "wrapped");
    expect(ctx.game.finalists()).toHaveLength(0);
    expect(ctx.game.winners()).toHaveLength(0);
  });
});

describe("Phase 2 — snapshot", () => {
  it("E32: snapshot → restore mid-game is identical and behaves identically", () => {
    const ctx = setup();
    const ids = Array.from({ length: 10 }, (_, i) => ctx.game.join(`p${i}`).player.id);
    goTo(ctx, isQ("q5"), (qid) => ids.forEach((id, i) => ctx.game.submitAnswer(id, qid, "ABCD"[(i * 7) % 4] as OptionKey)));
    ids.slice(0, 3).forEach((id) => ctx.game.submitAnswer(id, "q5", "D"));
    const snap = JSON.parse(JSON.stringify(ctx.game.snapshot())); // must survive JSON
    const restored = Game.restore(snap, { now: () => ctx.clock.t, questionMs: 20_000, minSceneGapMs: 600 });
    expect(restored.snapshot()).toEqual(ctx.game.snapshot());
    for (const g of [ctx.game, restored]) ids.slice(3).forEach((id) => g.submitAnswer(id, "q5", "B"));
    expect(restored.snapshot()).toEqual(ctx.game.snapshot());
    expect(restored.findByToken(ctx.game.getPlayer(ids[0])!.token)?.id).toBe(ids[0]);
  });
});
