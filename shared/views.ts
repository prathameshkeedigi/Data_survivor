// What each screen receives. The server builds these; raw answers never leave it.
import type { OptionKey } from "./questions";
import type { OptionCounts, PlayerStatus, Scene } from "./types";

export interface PublicQuestion {
  id: string;
  kind: "dilemma" | "finale" | "tiebreak";
  round: number;
  prompt: string;
  options: { key: OptionKey; text: string }[];
}

export interface RoundResultsView {
  round: number;
  n: number;
  questions: { qid: string; prompt: string; options: { key: OptionKey; text: string }[]; counts: OptionCounts; total: number }[];
}

export interface SurvivorsView {
  round: number;
  kept: number;
  eliminated: number;
}

export interface BaseView {
  scene: Scene;
  rehearsal: boolean;
  question: PublicQuestion | null;
  votingOpen: boolean;
  paused: boolean;
  /** Time left, measured on the server. Clients count down from when they received it. */
  msRemaining: number;
  playerCount: number;
  results: RoundResultsView | null;
  survivors: SurvivorsView | null;
  /** Data moment payload for the current round (Phase 5). */
  moment: unknown | null;
  finalistCount: number;
  /** Winners scene only. nickname is null when the host hid it. */
  winners: { rank: number; nickname: string | null }[] | null;
  /** Finale answer reveal (only after the question closed). */
  reveal: { qid: string; correct: OptionKey } | null;
}

export interface PlayerMe {
  id: string;
  nickname: string;
  status: PlayerStatus;
  rejoinCode: string;
  isFinalist: boolean;
  isWinner: boolean;
}

export interface RoundCard {
  round: number;
  items: { qid: string; prompt: string; myOption: OptionKey | null; myText: string | null; pctSame: number | null; n: number }[];
  /** null until survivors are locked */
  survived: boolean | null;
}

export interface PlayerView extends BaseView {
  kind: "player";
  me: PlayerMe | null;
  myAnswer: OptionKey | null;
  roundCard: RoundCard | null;
  /** Personal data-moment card (Phase 5) */
  momentCard: unknown | null;
  /** Wrapped story (Phase 6) */
  wrapped: unknown | null;
  finaleScore: { correct: number; of: number } | null;
}

export interface ScreenView extends BaseView {
  kind: "screen";
  answered: number;
}

export interface HostInfo {
  locked: boolean;
  suggestedKeep: number;
  activeCount: number;
  analystCount: number;
  tiedAtCutoff: number;
  finalists: number;
  winnersLocked: boolean;
  winnersPreview: { playerId: string; nickname: string; correct: number; timeOnCorrectMs: number }[];
  joinsLocked: boolean;
  sceneIndex: number;
  sceneCount: number;
  nextScene: Scene | null;
  momentStatus: "none" | "ready" | "failed";
}

export interface HostView extends BaseView {
  kind: "host";
  answered: number;
  host: HostInfo;
}

export interface CountUpdate {
  players: number;
  answered: number;
}
