import { DILEMMA_QUESTIONS, FINALE_QUESTIONS, OPTION_KEYS, type OptionKey } from "../../shared/questions";
import { FINALE_ANSWER_KEY } from "../finaleKeys";
import { mulberry32 } from "./rng";

/** The proposal's audience scenarios. "Small room" is any scenario with a small n. */
export const SCENARIOS = ["even", "favourite", "consensus", "hidden_groups", "weak_groups", "missing"] as const;
export type Scenario = (typeof SCENARIOS)[number];

export interface SimAnswer {
  option: OptionKey | null;
  /** ms after the question opens */
  delay: number;
}

export interface SimPlayer {
  id: string;
  nickname: string;
  /** Index into the question order (dilemmas then finale) at which this player joins. 0 = from the start. */
  joinAt: number;
  answers: Record<string, SimAnswer>;
}

export interface Audience {
  scenario: Scenario;
  seed: number;
  players: SimPlayer[];
  /** The population's expected share of each option, per question. */
  priors: Record<string, number[]>;
}

const QUESTION_ORDER = [...DILEMMA_QUESTIONS, ...FINALE_QUESTIONS].map((q) => q.id);

function pick(rand: () => number, probs: number[]): number {
  let r = rand();
  for (let i = 0; i < probs.length; i++) {
    r -= probs[i];
    if (r < 0) return i;
  }
  return probs.length - 1;
}

export function simulateAudience(n: number, scenario: Scenario, seed: number, opts: { bots?: boolean } = {}): Audience {
  const rand = mulberry32(seed * 7919 + SCENARIOS.indexOf(scenario));
  const uniform = [0.25, 0.25, 0.25, 0.25];
  const peaked = (fav: number, strength: number) => uniform.map((_, i) => (i === fav ? strength : (1 - strength) / 3));

  // Per-question generative distributions for each "type" of person.
  const groupCount = 4;
  const strength = scenario === "weak_groups" ? 0.4 : 0.75;
  const groupFav = Array.from({ length: groupCount }, () => DILEMMA_QUESTIONS.map(() => Math.floor(rand() * 4)));
  const roomFav = DILEMMA_QUESTIONS.map(() => Math.floor(rand() * 4));

  const distFor = (group: number, qi: number): number[] => {
    switch (scenario) {
      case "even":
        return uniform;
      case "favourite":
        return peaked(roomFav[qi], 0.75);
      case "consensus":
        return peaked(roomFav[qi], 0.95);
      default:
        return peaked(groupFav[group][qi], strength);
    }
  };

  const priors: Record<string, number[]> = {};
  DILEMMA_QUESTIONS.forEach((q, qi) => {
    const mix = [0, 0, 0, 0];
    for (let g = 0; g < groupCount; g++) distFor(g, qi).forEach((p, i) => (mix[i] += p / groupCount));
    priors[q.id] = mix;
  });

  const skipRate = scenario === "missing" ? 0.2 : 0.02;
  const lateRate = scenario === "missing" ? 0.15 : 0;
  const players: SimPlayer[] = [];
  for (let i = 0; i < n; i++) {
    const group = Math.floor(rand() * groupCount);
    const joinAt = rand() < lateRate ? 1 + Math.floor(rand() * (QUESTION_ORDER.length - 1)) : 0;
    const skill = 0.4 + rand() * 0.5;
    const answers: Record<string, SimAnswer> = {};
    DILEMMA_QUESTIONS.forEach((q, qi) => {
      const skip = rand() < skipRate;
      answers[q.id] = { option: skip ? null : OPTION_KEYS[pick(rand, distFor(group, qi))], delay: 1500 + Math.floor(rand() * 15000) };
    });
    for (const q of FINALE_QUESTIONS) {
      const right = rand() < skill;
      const wrong = OPTION_KEYS.filter((k) => k !== FINALE_ANSWER_KEY[q.id]);
      answers[q.id] = {
        option: right ? FINALE_ANSWER_KEY[q.id] : wrong[Math.floor(rand() * 3)],
        delay: 2000 + Math.floor(rand() * 14000),
      };
    }
    players.push({ id: `sim${String(i).padStart(4, "0")}`, nickname: `Sim ${i}`, joinAt, answers });
  }

  if (opts.bots) {
    const bot = (id: string, choose: (qid: string) => OptionKey): SimPlayer => {
      const answers: Record<string, SimAnswer> = {};
      for (const qid of QUESTION_ORDER) answers[qid] = { option: choose(qid), delay: 5000 };
      return { id, nickname: id, joinAt: 0, answers };
    };
    players.push(
      bot("bot_sneaky", (qid) => {
        const p = priors[qid];
        if (!p) return FINALE_ANSWER_KEY[qid] ?? "A";
        return OPTION_KEYS[p.indexOf(Math.min(...p))];
      }),
      bot("bot_random", (qid) => (priors[qid] ? OPTION_KEYS[Math.floor(rand() * 4)] : (FINALE_ANSWER_KEY[qid] ?? "A"))),
    );
  }

  return { scenario, seed, players, priors };
}

export { QUESTION_ORDER };
