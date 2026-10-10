import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { ALL_QUESTIONS, DILEMMA_QUESTIONS, FINALE_QUESTIONS, OPTION_KEYS, QUESTION_BY_ID, type OptionKey } from "../../shared/questions";
import type { GameError, OptionCounts, PlayerStatus, Result, Scene } from "../../shared/types";
import { FINALE_ANSWER_KEY } from "../finaleKeys";
import { emptyCounts, scoreQuestion } from "./scoring";

export interface GameOptions {
  now: () => number;
  questionMs: number;
  finaleMs?: number;
  /** Minimum time between host scene actions, so a double-press can't skip a scene. */
  minSceneGapMs: number;
  idGen?: () => string;
}

export interface Player {
  id: string;
  token: string;
  rejoinCode: string;
  nickname: string;
  joinedAt: number;
  status: PlayerStatus;
  eliminatedRound: number | null;
}

export interface AnswerRecord {
  option: OptionKey;
  /** Server-measured time from question open to answer, excluding pauses. */
  ms: number;
}

export interface Voting {
  qid: string;
  openedAt: number;
  closesAt: number;
  open: boolean;
  pausedAt: number | null;
  pausedRemaining: number | null;
}

export interface RoundResults {
  round: number;
  /** Players who answered at least one question in the round. */
  n: number;
  questions: { qid: string; counts: OptionCounts; total: number }[];
}

export interface RankedPlayer {
  playerId: string;
  score: number;
  timeMs: number;
}

export interface FinaleRanked {
  playerId: string;
  correct: number;
  timeOnCorrectMs: number;
  tbCorrect: boolean;
  tbMs: number;
}

interface RoundLock {
  keep: number;
  survivors: string[];
  preLock: Record<string, PlayerStatus>;
}

export interface GameState {
  players: Record<string, Player>;
  joinOrder: string[];
  answers: Record<string, Record<string, AnswerRecord>>;
  sceneIndex: number;
  lastActionAt: number | null;
  voting: Voting | null;
  questionDurations: Record<string, number>;
  roundResults: Record<string, RoundResults>;
  locks: Record<string, RoundLock>;
  winners: string[] | null;
  hiddenWinnerNames: string[];
}

export const MAX_WINNERS = 20;
const KEEP_RATIO: Record<number, number> = { 1: 0.65, 2: 0.6, 3: 0.45 };
const FINALISTS = 20;
const REJOIN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

export function buildScenes(): Scene[] {
  const scenes: Scene[] = [{ type: "lobby" }];
  for (const round of [1, 2, 3, 4]) {
    for (const q of DILEMMA_QUESTIONS.filter((x) => x.round === round)) scenes.push({ type: "question", qid: q.id, round });
    scenes.push({ type: "results", round }, { type: "survivors", round }, { type: "moment", round });
  }
  scenes.push({ type: "finale_intro" });
  for (const q of FINALE_QUESTIONS) scenes.push({ type: "question", qid: q.id, round: 5 });
  scenes.push({ type: "finale_results" }, { type: "winners" }, { type: "recap" }, { type: "wrapped" });
  return scenes;
}

export const SCENES = buildScenes();
const FIRST_RESULTS_INDEX = SCENES.findIndex((s) => s.type === "results");

const fail = (error: GameError) => ({ ok: false as const, error });

export class Game {
  private s: GameState;
  private byToken = new Map<string, string>();
  private byCode = new Map<string, string>();

  constructor(private opts: GameOptions, state?: GameState) {
    this.s = state ?? {
      players: {},
      joinOrder: [],
      answers: {},
      sceneIndex: 0,
      lastActionAt: null,
      voting: null,
      questionDurations: {},
      roundResults: {},
      locks: {},
      winners: null,
      hiddenWinnerNames: [],
    };
    for (const p of Object.values(this.s.players)) {
      this.byToken.set(p.token, p.id);
      this.byCode.set(p.rejoinCode, p.id);
    }
  }

  static restore(state: GameState, opts: GameOptions): Game {
    return new Game(opts, structuredClone(state));
  }

  snapshot(): GameState {
    return structuredClone(this.s);
  }

  private now() {
    return this.opts.now();
  }

  // ---------- players ----------

  join(nickname: string): { ok: true; player: Player } {
    const id = this.opts.idGen?.() ?? randomUUID();
    let code: string;
    do {
      code = Array.from({ length: 4 }, () => REJOIN_ALPHABET[randomInt(REJOIN_ALPHABET.length)]).join("");
    } while (this.byCode.has(code));
    const player: Player = {
      id,
      token: randomBytes(18).toString("base64url"),
      rejoinCode: code,
      nickname: nickname.replace(/\s+/g, " ").trim().slice(0, 16) || "Player",
      joinedAt: this.now(),
      status: this.s.sceneIndex < FIRST_RESULTS_INDEX ? "active" : "late",
      eliminatedRound: null,
    };
    this.s.players[id] = player;
    this.s.joinOrder.push(id);
    this.byToken.set(player.token, id);
    this.byCode.set(code, id);
    return { ok: true, player: { ...player } };
  }

  getPlayer(id: string): Player | undefined {
    const p = this.s.players[id];
    return p && { ...p };
  }

  findByToken(token: string): Player | undefined {
    const id = this.byToken.get(token);
    return id ? this.getPlayer(id) : undefined;
  }

  findByRejoinCode(code: string): Player | undefined {
    const id = this.byCode.get(String(code).trim().toUpperCase());
    return id ? this.getPlayer(id) : undefined;
  }

  get playerCount() {
    return this.s.joinOrder.length;
  }

  get players(): Player[] {
    return this.s.joinOrder.map((id) => ({ ...this.s.players[id] }));
  }

  // ---------- scenes ----------

  get scene(): Scene {
    return SCENES[this.s.sceneIndex];
  }

  get sceneIndex() {
    return this.s.sceneIndex;
  }

  get voting(): Voting | null {
    return this.s.voting && { ...this.s.voting };
  }

  get votingOpen(): boolean {
    const v = this.s.voting;
    const sc = this.scene;
    return !!v && v.open && sc.type === "question" && sc.qid === v.qid;
  }

  private guardGap(): GameError | null {
    const last = this.s.lastActionAt;
    if (last !== null && this.now() - last < this.opts.minSceneGapMs) return "TOO_FAST";
    return null;
  }

  advance(): Result {
    const tooFast = this.guardGap();
    if (tooFast) return fail(tooFast);
    if (this.votingOpen) {
      this.closeVoting();
      this.s.lastActionAt = this.now();
      return { ok: true };
    }
    const sc = this.scene;
    if (this.s.sceneIndex >= SCENES.length - 1) return fail("AT_END");
    if (sc.type === "results" && !this.isRoundLocked(sc.round)) return fail("LOCK_REQUIRED");
    if (sc.type === "finale_results" && !this.winnersLocked) return fail("LOCK_REQUIRED");
    this.s.sceneIndex++;
    this.s.lastActionAt = this.now();
    this.enterScene();
    return { ok: true };
  }

  back(): Result {
    const tooFast = this.guardGap();
    if (tooFast) return fail(tooFast);
    if (this.votingOpen) return fail("WRONG_SCENE");
    if (this.s.sceneIndex === 0) return fail("AT_START");
    this.s.sceneIndex--;
    this.s.lastActionAt = this.now();
    return { ok: true };
  }

  private enterScene() {
    const sc = this.scene;
    if (sc.type === "question" && !(sc.qid in this.s.questionDurations)) {
      const duration = sc.round === 5 ? (this.opts.finaleMs ?? this.opts.questionMs) : this.opts.questionMs;
      const now = this.now();
      this.s.questionDurations[sc.qid] = duration;
      this.s.answers[sc.qid] ??= {};
      this.s.voting = { qid: sc.qid, openedAt: now, closesAt: now + duration, open: true, pausedAt: null, pausedRemaining: null };
    }
    if (sc.type === "results" && !this.s.roundResults[sc.round]) {
      this.s.roundResults[sc.round] = this.computeRoundResults(sc.round);
    }
  }

  private closeVoting() {
    if (this.s.voting) {
      this.s.voting.open = false;
      this.s.voting.pausedAt = null;
      this.s.voting.pausedRemaining = null;
    }
  }

  /** Call regularly (server interval). Returns true if voting just closed. */
  tick(): boolean {
    const v = this.s.voting;
    if (v && v.open && v.pausedAt === null && this.now() > v.closesAt) {
      this.closeVoting();
      return true;
    }
    return false;
  }

  msRemaining(): number {
    const v = this.s.voting;
    if (!v || !v.open) return 0;
    if (v.pausedRemaining !== null) return v.pausedRemaining;
    return Math.max(0, v.closesAt - this.now());
  }

  get paused(): boolean {
    return !!this.s.voting?.open && this.s.voting.pausedAt !== null;
  }

  pause(): Result {
    const v = this.s.voting;
    if (!v || !v.open) return fail("NOT_OPEN");
    if (v.pausedAt === null) {
      v.pausedAt = this.now();
      v.pausedRemaining = Math.max(0, v.closesAt - v.pausedAt);
    }
    return { ok: true };
  }

  resume(): Result {
    const v = this.s.voting;
    if (!v || !v.open) return fail("NOT_OPEN");
    if (v.pausedAt !== null && v.pausedRemaining !== null) {
      const now = this.now();
      v.openedAt += now - v.pausedAt; // paused time doesn't count towards answer times
      v.closesAt = now + v.pausedRemaining;
      v.pausedAt = null;
      v.pausedRemaining = null;
    }
    return { ok: true };
  }

  // ---------- answers ----------

  submitAnswer(playerId: string, qid: string, option: unknown): Result<{ duplicate: boolean; option: OptionKey; ms: number }> {
    if (!this.s.players[playerId]) return fail("UNKNOWN_PLAYER");
    if (typeof option !== "string" || !(OPTION_KEYS as readonly string[]).includes(option)) return fail("INVALID_OPTION");
    if (!QUESTION_BY_ID[qid]) return fail("UNKNOWN_QUESTION");
    const existing = this.s.answers[qid]?.[playerId];
    if (existing) return { ok: true, duplicate: true, option: existing.option, ms: existing.ms };
    const v = this.s.voting;
    if (!v || v.qid !== qid || !v.open) return fail("NOT_OPEN");
    if (v.pausedAt !== null) return fail("PAUSED");
    const now = this.now();
    if (now > v.closesAt) return fail("NOT_OPEN");
    const rec: AnswerRecord = { option: option as OptionKey, ms: now - v.openedAt };
    this.s.answers[qid][playerId] = rec;
    return { ok: true, duplicate: false, ...rec };
  }

  answerOf(playerId: string, qid: string): OptionKey | undefined {
    return this.s.answers[qid]?.[playerId]?.option;
  }

  answerRecord(playerId: string, qid: string): AnswerRecord | undefined {
    return this.s.answers[qid]?.[playerId];
  }

  /** Everyone's dilemma answers, for the analytics. */
  answersTable(): Map<string, Record<string, OptionKey | null>> {
    const table = new Map<string, Record<string, OptionKey | null>>();
    for (const id of this.s.joinOrder) {
      const row: Record<string, OptionKey | null> = {};
      for (const q of DILEMMA_QUESTIONS) row[q.id] = this.s.answers[q.id]?.[id]?.option ?? null;
      table.set(id, row);
    }
    return table;
  }

  answerCount(qid: string): number {
    return Object.keys(this.s.answers[qid] ?? {}).length;
  }

  // ---------- rounds ----------

  private roundQids(round: number) {
    return ALL_QUESTIONS.filter((q) => q.round === round).map((q) => q.id);
  }

  private computeRoundResults(round: number): RoundResults {
    const qids = this.roundQids(round);
    const answered = new Set<string>();
    const questions = qids.map((qid) => {
      const counts = emptyCounts();
      const ans = this.s.answers[qid] ?? {};
      for (const [pid, a] of Object.entries(ans)) {
        counts[a.option]++;
        answered.add(pid);
      }
      return { qid, counts, total: Object.keys(ans).length };
    });
    return { round, n: answered.size, questions };
  }

  /** Frozen when the results scene is first shown. */
  roundResults(round: number): RoundResults | undefined {
    const r = this.s.roundResults[round];
    return r && structuredClone(r);
  }

  isRoundLocked(round: number): boolean {
    return !!this.s.locks[round];
  }

  suggestedKeep(round: number, active: number): number {
    const raw = round === 4 ? Math.min(FINALISTS, active) : Math.round(active * (KEEP_RATIO[round] ?? 1));
    return Math.max(1, Math.min(raw, active));
  }

  /** All players' answers count towards shares; only active players are ranked. */
  roundRanking(round: number, keep?: number): { ranked: RankedPlayer[]; suggestedKeep: number; tiedAtCutoff: number } {
    const qids = this.roundQids(round);
    const ids = this.s.joinOrder;
    const total = new Map<string, number>(ids.map((id) => [id, 0]));
    const time = new Map<string, number>(ids.map((id) => [id, 0]));
    for (const qid of qids) {
      const ans = this.s.answers[qid] ?? {};
      const scored = scoreQuestion(new Map(ids.map((id) => [id, ans[id]?.option ?? null])));
      const duration = this.s.questionDurations[qid] ?? this.opts.questionMs;
      for (const id of ids) {
        total.set(id, total.get(id)! + scored.scores.get(id)!);
        time.set(id, time.get(id)! + (ans[id]?.ms ?? duration));
      }
    }
    const ranked = ids
      .filter((id) => this.s.players[id].status === "active")
      .map((id) => ({ playerId: id, score: total.get(id)! / qids.length, timeMs: time.get(id)! }))
      .sort((a, b) => b.score - a.score || a.timeMs - b.timeMs || (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0));
    const suggestedKeep = this.suggestedKeep(round, ranked.length);
    const k = Math.min(keep ?? suggestedKeep, ranked.length);
    const cutScore = k > 0 ? ranked[k - 1].score : null;
    const tiedAtCutoff = cutScore === null ? 0 : ranked.filter((r) => r.score === cutScore).length;
    return { ranked, suggestedKeep, tiedAtCutoff };
  }

  lockSurvivors(round: number, keep: number): Result<{ survivors: number; eliminated: number }> {
    if (!Number.isInteger(keep) || keep < 1) return fail("INVALID_CUTOFF");
    const sc = this.scene;
    if (sc.type !== "results" || sc.round !== round) return fail("WRONG_SCENE");
    const previous = this.s.locks[round];
    if (previous) {
      for (const [id, status] of Object.entries(previous.preLock)) {
        this.s.players[id].status = status;
        this.s.players[id].eliminatedRound = status === "eliminated" ? this.s.players[id].eliminatedRound : null;
      }
    }
    const preLock: Record<string, PlayerStatus> = {};
    for (const id of this.s.joinOrder) preLock[id] = this.s.players[id].status;
    const { ranked } = this.roundRanking(round);
    const survivors = ranked.slice(0, keep).map((r) => r.playerId);
    for (const r of ranked.slice(keep)) {
      this.s.players[r.playerId].status = "eliminated";
      this.s.players[r.playerId].eliminatedRound = round;
    }
    this.s.locks[round] = { keep, survivors, preLock };
    return { ok: true, survivors: survivors.length, eliminated: Math.max(0, ranked.length - keep) };
  }

  // ---------- finale ----------

  finalists(): Player[] {
    if (!this.s.locks[4]) return [];
    return this.s.joinOrder.filter((id) => this.s.players[id].status === "active").map((id) => ({ ...this.s.players[id] }));
  }

  finaleRanking(): FinaleRanked[] {
    const scored = FINALE_QUESTIONS.filter((q) => q.kind === "finale").map((q) => q.id);
    const tb = FINALE_QUESTIONS.find((q) => q.kind === "tiebreak")!.id;
    const never = Number.MAX_SAFE_INTEGER;
    return this.finalists()
      .map((p) => {
        let correct = 0;
        let timeOnCorrectMs = 0;
        for (const qid of scored) {
          const a = this.s.answers[qid]?.[p.id];
          if (a && a.option === FINALE_ANSWER_KEY[qid]) {
            correct++;
            timeOnCorrectMs += a.ms;
          }
        }
        const t = this.s.answers[tb]?.[p.id];
        return { playerId: p.id, correct, timeOnCorrectMs, tbCorrect: !!t && t.option === FINALE_ANSWER_KEY[tb], tbMs: t?.ms ?? never };
      })
      .sort(
        (a, b) =>
          b.correct - a.correct ||
          a.timeOnCorrectMs - b.timeOnCorrectMs ||
          Number(b.tbCorrect) - Number(a.tbCorrect) ||
          a.tbMs - b.tbMs ||
          (a.playerId < b.playerId ? -1 : 1),
      );
  }

  get winnersLocked(): boolean {
    return this.s.winners !== null;
  }

  lockWinners(count: number, hideNicknamesOf: string[] = []): Result<{ winners: number }> {
    if (!Number.isInteger(count) || count < 1 || count > MAX_WINNERS) return fail("INVALID_CUTOFF");
    if (this.scene.type !== "finale_results") return fail("WRONG_SCENE");
    this.s.winners = this.finaleRanking().slice(0, count).map((r) => r.playerId);
    this.s.hiddenWinnerNames = hideNicknamesOf.filter((id) => this.s.winners!.includes(id));
    return { ok: true, winners: this.s.winners.length };
  }

  winners(): Player[] {
    return (this.s.winners ?? []).map((id) => ({ ...this.s.players[id] }));
  }

  isWinnerNameHidden(id: string): boolean {
    return this.s.hiddenWinnerNames.includes(id);
  }
}
