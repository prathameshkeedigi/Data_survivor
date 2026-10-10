import { DILEMMA_QUESTIONS, FINALE_QUESTIONS, ALL_QUESTIONS, OPTION_KEYS, WRAPPED_TAGS } from "../../shared/questions";
import { FINALE_ANSWER_KEY } from "../../server/finaleKeys";

describe("Phase 1 — question bank", () => {
  it("F1a: 12 dilemma questions, exactly 3 in each of rounds 1–4", () => {
    expect(DILEMMA_QUESTIONS).toHaveLength(12);
    for (const round of [1, 2, 3, 4]) {
      expect(DILEMMA_QUESTIONS.filter((q) => q.round === round)).toHaveLength(3);
    }
  });

  it("F1b: every dilemma has options A–D in order, non-empty text and a valid Wrapped tag", () => {
    for (const q of DILEMMA_QUESTIONS) {
      expect(q.prompt.trim().length).toBeGreaterThan(0);
      expect(q.options.map((o) => o.key)).toEqual([...OPTION_KEYS]);
      for (const o of q.options) {
        expect(o.text.trim().length).toBeGreaterThan(0);
        expect(WRAPPED_TAGS).toContain(o.tag);
      }
    }
  });

  it("F1c: finale has 3 scored + 1 tie-breaker, each with 4 options and a server-side answer key", () => {
    expect(FINALE_QUESTIONS.filter((q) => q.kind === "finale")).toHaveLength(3);
    expect(FINALE_QUESTIONS.filter((q) => q.kind === "tiebreak")).toHaveLength(1);
    for (const q of FINALE_QUESTIONS) {
      expect(q.options.map((o) => o.key)).toEqual([...OPTION_KEYS]);
      expect(OPTION_KEYS).toContain(FINALE_ANSWER_KEY[q.id]);
    }
  });

  it("F1d: all question IDs are unique", () => {
    const ids = ALL_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
