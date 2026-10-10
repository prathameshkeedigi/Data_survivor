// Data-moment payloads (projector) and personal cards (phones). Aggregates only — no player IDs.
import type { OptionKey } from "./questions";
import type { OptionCounts } from "./types";

export interface TooFew {
  kind: "too_few";
  moment: "spread" | "pattern" | "groups" | "prediction";
  n: number;
  need: number;
  sentence: string;
}

export interface SpreadQuestion {
  qid: string;
  num: number;
  prompt: string;
  options: { key: OptionKey; text: string }[];
  counts: OptionCounts;
  pct: Record<OptionKey, number>;
  label: "near-even split" | "leaning one way" | "strong favourite";
  /** ± percentage points on the top answer (95% margin of error) */
  moe: number;
}

export interface SpreadMoment {
  kind: "spread";
  n: number;
  questions: SpreadQuestion[];
  callout: string;
  sentence: string;
}

export interface PatternBest {
  qa: string;
  qb: string;
  numA: number;
  numB: number;
  promptA: string;
  promptB: string;
  optA: OptionKey;
  optB: OptionKey;
  textA: string;
  textB: string;
  lift: number;
  countBoth: number;
  /** P(B | A) and P(B), in % */
  pctBGivenA: number;
  pctB: number;
  likelyReal: boolean;
  /** 4×4 counts between the two questions (rows: A options, cols: B options). Cells under 5 are hidden as 0. */
  matrix: number[][];
  optionsA: string[];
  optionsB: string[];
}

export interface PatternMoment {
  kind: "pattern";
  n: number;
  best: PatternBest | null;
  sentence: string;
}

export interface GroupsMoment {
  kind: "groups";
  n: number;
  /** 0–1 coordinates; g = group index or -1 */
  points: { x: number; y: number; g: number }[];
  groups: { id: number; size: number; label: string | null; top: { num: number; text: string }[] }[];
  sentence: string;
}

export interface PredictionMoment {
  kind: "prediction";
  n: number;
  qid: string;
  num: number;
  k: number;
  lazyPct: number;
  smartPct: number;
  beatsLazy: boolean;
  sentence: string;
}

export type Moment = TooFew | SpreadMoment | PatternMoment | GroupsMoment | PredictionMoment;

export type MomentCard =
  | { kind: "spread"; num: number; prompt: string; text: string; pct: number }
  | { kind: "pattern"; numA: number; numB: number; same: number; pct: number; fewerThan5: boolean }
  | { kind: "groups"; index: number; group: number; groupLabel: string | null; similar: number }
  | { kind: "prediction"; same: number; k: number; myText: string }
  | { kind: "none"; reason: string };

export interface WrappedData {
  n: number;
  answered: number;
  rarest: {
    qid: string;
    num: number;
    prompt: string;
    text: string;
    pct: number;
    count: number;
    option: OptionKey;
    /** % of the room per option on that question */
    dist: Record<OptionKey, number>;
  } | null;
  /** One entry per dilemma question, in order: did you go with the most popular answer? */
  timeline: { num: number; mark: "with" | "against" | "skip" }[];
  /** How many of your answers carried each playful tag */
  tags: Record<string, number>;
  /** Per round: average % of the room that chose the same as you, vs the room's average */
  rounds: { round: number; me: number | null; room: number }[];
  againstMajority: { count: number; of: number };
  label: { name: string; tag: string | null; evidence: { num: number; prompt: string; text: string }[] };
  map: { points: GroupsMoment["points"]; myIndex: number; groupLabel: string | null } | null;
  nickname: string;
  status: "winner" | "finalist" | "survivor" | "analyst";
}
