import { computeWrapped, LABELS } from "../../server/analytics/wrapped";
import { DILEMMA_QUESTIONS, type OptionKey } from "../../shared/questions";

type Row = Record<string, OptionKey | null>;
const allA = (): Row => Object.fromEntries(DILEMMA_QUESTIONS.map((q) => [q.id, "A"]));

describe("Phase 6 — Wrapped", () => {
  it("W1: rarest choice and 'against the room' are correct for a hand-made room", () => {
    // 10 people all answer A everywhere, except 'me' who answers B on q3 and C on q7.
    const answers = new Map<string, Row>();
    for (let i = 0; i < 9; i++) answers.set(`p${i}`, allA());
    answers.set("me", { ...allA(), q3: "B", q7: "C" });
    const w = computeWrapped(answers).get("me")!;
    expect(w.n).toBe(10);
    expect(w.answered).toBe(12);
    expect(w.rarest).toMatchObject({ pct: 10, count: 1 });
    expect(["q3", "q7"]).toContain(w.rarest!.qid);
    expect(w.againstMajority).toEqual({ count: 2, of: 12 });
    const typical = computeWrapped(answers).get("p0")!;
    expect(typical.againstMajority).toEqual({ count: 0, of: 12 });
    expect(typical.rarest!.pct).toBe(90);
  });

  it("W2: a clear tag winner gets its label; a thin record gets 'A bit of everything'", () => {
    const evidenceFan: Row = {};
    for (const q of DILEMMA_QUESTIONS) evidenceFan[q.id] = (q.options.find((o) => o.tag === "evidence") ?? q.options[0]).key;
    const answers = new Map<string, Row>([["fan", evidenceFan]]);
    for (let i = 0; i < 5; i++) answers.set(`p${i}`, allA());
    answers.set("thin", { q1: "A", q2: "B" });
    const all = computeWrapped(answers);
    expect(all.get("fan")!.label.name).toBe(LABELS.evidence);
    expect(all.get("fan")!.label.evidence.length).toBeGreaterThan(0);
    expect(all.get("fan")!.label.evidence.length).toBeLessThanOrEqual(3);
    expect(all.get("thin")!.label.name).toBe("A bit of everything");
  });

  it("W3: skipped everything / joined late still gives a sensible, NaN-free Wrapped", () => {
    const answers = new Map<string, Row>([
      ["ghost", {}],
      ["late", { q10: "B", q11: null, q12: "D" }],
      ["p1", allA()],
    ]);
    const all = computeWrapped(answers);
    const ghost = all.get("ghost")!;
    expect(ghost.answered).toBe(0);
    expect(ghost.rarest).toBeNull();
    expect(ghost.againstMajority).toEqual({ count: 0, of: 0 });
    expect(JSON.stringify([...all.values()])).not.toMatch(/NaN|Infinity/);
    expect(all.get("late")!.answered).toBe(2);
  });
});
