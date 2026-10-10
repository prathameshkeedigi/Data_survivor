import type { OptionKey } from "./questions";

export type Scene =
  | { type: "lobby" }
  | { type: "question"; qid: string; round: number }
  | { type: "results"; round: number }
  | { type: "survivors"; round: number }
  | { type: "moment"; round: number }
  | { type: "finale_intro" }
  | { type: "finale_results" }
  | { type: "winners" }
  | { type: "recap" }
  | { type: "wrapped" };

/** active = still in the game; eliminated / late = Analyst Mode. */
export type PlayerStatus = "active" | "eliminated" | "late";

export type GameError =
  | "NOT_OPEN"
  | "PAUSED"
  | "INVALID_OPTION"
  | "UNKNOWN_PLAYER"
  | "UNKNOWN_QUESTION"
  | "INVALID_CUTOFF"
  | "LOCK_REQUIRED"
  | "WRONG_SCENE"
  | "TOO_FAST"
  | "AT_END"
  | "AT_START";

export type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: GameError };

export type OptionCounts = Record<OptionKey, number>;
