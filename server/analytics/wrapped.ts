import { DILEMMA_QUESTIONS, OPTION_KEYS, type OptionKey, type WrappedTag } from "../../shared/questions";
import type { WrappedData } from "../../shared/moments";
import type { Answers } from "./moments";

export const LABELS: Record<WrappedTag, string> = {
  evidence: "Evidence Hunter",
  experiment: "Experimenter",
  independent: "Independent Builder",
  systems: "Systems Thinker",
  strategic: "Strategic Planner",
};

export type WrappedCore = Omit<WrappedData, "map" | "nickname" | "status">;

/** Everyone's Wrapped stats in one pass over the room. Labels are playful, not psychology. */
export function computeWrapped(ans: Answers): Map<string, WrappedCore> {
  const people = [...ans.entries()].filter(([, r]) => DILEMMA_QUESTIONS.some((q) => r[q.id]));
  const counts: Record<string, Record<OptionKey, number>> = {};
  const totals: Record<string, number> = {};
  for (const q of DILEMMA_QUESTIONS) {
    counts[q.id] = { A: 0, B: 0, C: 0, D: 0 };
    totals[q.id] = 0;
    for (const [, r] of people) {
      const o = r[q.id];
      if (o) {
        counts[q.id][o]++;
        totals[q.id]++;
      }
    }
  }

  const out = new Map<string, WrappedCore>();
  for (const [id, r] of ans) {
    const mine = DILEMMA_QUESTIONS.map((q, i) => ({ q, num: i + 1, opt: r[q.id] })).filter((x) => x.opt) as {
      q: (typeof DILEMMA_QUESTIONS)[number];
      num: number;
      opt: OptionKey;
    }[];
    const pctOf = (x: (typeof mine)[number]) => Math.round((100 * counts[x.q.id][x.opt]) / totals[x.q.id]);

    const rarestPick = [...mine].sort((a, b) => pctOf(a) - pctOf(b) || a.num - b.num)[0];
    const rarest = rarestPick
      ? {
          qid: rarestPick.q.id,
          num: rarestPick.num,
          prompt: rarestPick.q.prompt,
          text: rarestPick.q.options.find((o) => o.key === rarestPick.opt)!.text,
          pct: pctOf(rarestPick),
          count: counts[rarestPick.q.id][rarestPick.opt],
        }
      : null;

    const against = mine.filter((x) => {
      const top = Math.max(...OPTION_KEYS.map((k) => counts[x.q.id][k]));
      return counts[x.q.id][x.opt] < top;
    }).length;

    const tagCount: Partial<Record<WrappedTag, number>> = {};
    for (const x of mine) {
      const tag = x.q.options.find((o) => o.key === x.opt)!.tag!;
      tagCount[tag] = (tagCount[tag] ?? 0) + 1;
    }
    const ranked = (Object.entries(tagCount) as [WrappedTag, number][]).sort((a, b) => b[1] - a[1]);
    const [topTag, topN] = ranked[0] ?? [null, 0];
    const second = ranked[1]?.[1] ?? 0;
    const clear = topTag !== null && topN >= 4 && topN - second >= 2;
    const support = (clear ? mine.filter((x) => x.q.options.find((o) => o.key === x.opt)!.tag === topTag) : mine)
      .slice(0, 3)
      .map((x) => ({ num: x.num, prompt: x.q.prompt, text: x.q.options.find((o) => o.key === x.opt)!.text }));

    out.set(id, {
      n: people.length,
      answered: mine.length,
      rarest,
      againstMajority: { count: against, of: mine.length },
      label: clear ? { name: LABELS[topTag!], tag: topTag, evidence: support } : { name: "A bit of everything", tag: null, evidence: support },
    });
  }
  return out;
}
