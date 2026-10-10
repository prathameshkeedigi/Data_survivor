import { Game } from "../engine/game";
import { QUESTION_ORDER, type Audience } from "./audience";

export interface SimResult {
  game: Game;
  activeBeforeRound4: number;
  finalists: number;
  finalistIds: string[];
  winners: number;
}

/** Plays a whole game with a simulated audience and a host who always accepts the suggested cutoffs. */
export function runSimulatedGame(audience: Audience, _seed: number, opts: { winners?: number } = {}): SimResult {
  const clock = { t: 0 };
  let nextId = "";
  const game = new Game({ now: () => clock.t, questionMs: 20_000, minSceneGapMs: 600, idGen: () => nextId });
  const realId = new Map<string, string>();
  const joinPending = [...audience.players].sort((a, b) => a.joinAt - b.joinAt);
  const joinUpTo = (questionIndex: number) => {
    while (joinPending.length && joinPending[0].joinAt <= questionIndex) {
      const sp = joinPending.shift()!;
      nextId = sp.id;
      realId.set(sp.id, game.join(sp.nickname).player.id);
    }
  };
  joinUpTo(0);

  let activeBeforeRound4 = 0;
  for (let guard = 0; guard < 500; guard++) {
    const sc = game.scene;
    if (sc.type === "wrapped") break;
    if (sc.type === "question" && game.votingOpen) {
      joinUpTo(QUESTION_ORDER.indexOf(sc.qid));
      const start = clock.t;
      const answering = audience.players
        .filter((p) => realId.has(p.id) && p.answers[sc.qid]?.option)
        .sort((a, b) => a.answers[sc.qid].delay - b.answers[sc.qid].delay);
      for (const p of answering) {
        clock.t = start + p.answers[sc.qid].delay;
        game.submitAnswer(realId.get(p.id)!, sc.qid, p.answers[sc.qid].option);
      }
    }
    if (sc.type === "results" && !game.isRoundLocked(sc.round)) {
      const ranking = game.roundRanking(sc.round);
      if (sc.round === 4) activeBeforeRound4 = ranking.ranked.length;
      game.lockSurvivors(sc.round, ranking.suggestedKeep);
    }
    if (sc.type === "finale_results" && !game.winnersLocked) {
      game.lockWinners(Math.max(1, Math.min(opts.winners ?? 10, game.finalists().length)));
    }
    clock.t += 700;
    game.tick();
    const r = game.advance();
    if (!r.ok) throw new Error(`simulation stuck at ${JSON.stringify(sc)}: ${r.error}`);
  }

  const finalistIds = game.finalists().map((p) => p.id);
  return { game, activeBeforeRound4, finalists: finalistIds.length, finalistIds, winners: game.winners().length };
}
