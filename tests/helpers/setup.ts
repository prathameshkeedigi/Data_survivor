import { Game, type GameOptions } from "../../server/engine/game";
import type { Scene } from "../../shared/types";

/** A game with a fake clock the test controls. */
export function setup(opts: Partial<GameOptions> = {}) {
  const clock = { t: 1_000_000 };
  let n = 0;
  const game = new Game({
    now: () => clock.t,
    questionMs: 20_000,
    minSceneGapMs: 600,
    idGen: () => `p${String(++n).padStart(4, "0")}`,
    ...opts,
  });
  const wait = (ms: number) => {
    clock.t += ms;
    game.tick();
  };
  /** Wait past the scene-change guard, then advance. */
  const next = () => {
    wait(700);
    return game.advance();
  };
  return { game, clock, wait, next };
}

export type Ctx = ReturnType<typeof setup>;

/** Move forward until the scene matches, auto-closing voting and locking with suggested cutoffs on the way. */
export function goTo(
  ctx: Ctx,
  match: (s: Scene) => boolean,
  onQuestion?: (qid: string) => void,
  keep?: (round: number) => number,
) {
  const { game, next } = ctx;
  for (let guard = 0; guard < 200 && !match(game.scene); guard++) {
    const s = game.scene;
    if (s.type === "question" && game.votingOpen) onQuestion?.(s.qid);
    if (s.type === "results" && !game.isRoundLocked(s.round))
      game.lockSurvivors(s.round, keep?.(s.round) ?? game.roundRanking(s.round).suggestedKeep);
    if (s.type === "finale_results" && !game.winnersLocked) game.lockWinners(Math.max(1, Math.min(10, game.finalists().length)));
    const r = next();
    if (!r.ok) throw new Error(`advance failed at ${JSON.stringify(s)}: ${r.error}`);
  }
  if (!match(game.scene)) throw new Error("scene not reached");
}

export const isQ = (qid: string) => (s: Scene) => s.type === "question" && s.qid === qid;
export const isResults = (round: number) => (s: Scene) => s.type === "results" && s.round === round;
