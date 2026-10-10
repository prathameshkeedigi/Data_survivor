import { OPTION_KEYS, type OptionKey } from "../../shared/questions";
import type { OptionCounts } from "../../shared/types";

export interface QuestionScore {
  counts: OptionCounts;
  /** Number of real answers (skips excluded). */
  total: number;
  /** Smoothed share p = (count + 1) / (total + 4). */
  shares: Record<OptionKey, number>;
  /** Rarity score per player: −ln(p) of their option, or the skip rule. */
  scores: Map<string, number>;
}

export const emptyCounts = (): OptionCounts => ({ A: 0, B: 0, C: 0, D: 0 });

/**
 * Score one question. `answers` maps every player in the room to their option, or null if they skipped.
 * A skip scores half the average score of those who answered, so skipping never pays.
 */
export function scoreQuestion(answers: Map<string, OptionKey | null>): QuestionScore {
  const counts = emptyCounts();
  let total = 0;
  for (const opt of answers.values()) {
    if (opt) {
      counts[opt]++;
      total++;
    }
  }

  const shares = {} as Record<OptionKey, number>;
  for (const k of OPTION_KEYS) shares[k] = (counts[k] + 1) / (total + OPTION_KEYS.length);

  const scores = new Map<string, number>();
  let sum = 0;
  for (const [id, opt] of answers) {
    if (!opt) continue;
    const s = -Math.log(shares[opt]);
    scores.set(id, s);
    sum += s;
  }
  const skipScore = total > 0 ? 0.5 * (sum / total) : 0;
  for (const [id, opt] of answers) if (!opt) scores.set(id, skipScore);

  return { counts, total, shares, scores };
}
