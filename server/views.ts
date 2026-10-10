import { QUESTION_BY_ID, type Question } from "../shared/questions";
import type { BaseView, HostView, PlayerView, PublicQuestion, RoundResultsView, ScreenView } from "../shared/views";
import { FINALE_ANSWER_KEY } from "./finaleKeys";
import { SCENES, type Game } from "./engine/game";

export interface ServerMeta {
  rehearsal: boolean;
  /** Host pressed F: the projector shows the pre-made simulated version of the current data moment. */
  fallback: boolean;
  joinsLocked: boolean;
  /** Extra per-round data moments (Phase 5), keyed by round. */
  moments: Record<number, { screen: unknown; perPlayer: (playerId: string) => unknown } | "failed">;
  wrapped: (playerId: string) => unknown | null;
}

const publicQuestion = (q: Question): PublicQuestion => ({
  id: q.id,
  kind: q.kind,
  round: q.round,
  prompt: q.prompt,
  options: q.options.map(({ key, text }) => ({ key, text })),
});

function resultsView(game: Game, round: number): RoundResultsView | null {
  const r = game.roundResults(round);
  if (!r) return null;
  return {
    round,
    n: r.n,
    questions: r.questions.map((q) => {
      const pq = publicQuestion(QUESTION_BY_ID[q.qid]);
      return { qid: q.qid, prompt: pq.prompt, options: pq.options, counts: q.counts, total: q.total };
    }),
  };
}

function sceneRound(game: Game): number | null {
  const sc = game.scene;
  return "round" in sc ? sc.round : null;
}

function base(game: Game, meta: ServerMeta): BaseView {
  const sc = game.scene;
  const round = sceneRound(game);
  const question = sc.type === "question" ? publicQuestion(QUESTION_BY_ID[sc.qid]) : null;
  const showResults = (sc.type === "results" || sc.type === "survivors" || sc.type === "moment") && round !== null;
  let survivors: BaseView["survivors"] = null;
  if ((sc.type === "survivors" || sc.type === "moment") && round !== null && game.isRoundLocked(round)) {
    const all = game.players;
    survivors = {
      round,
      kept: all.filter((p) => p.status === "active").length,
      eliminated: all.filter((p) => p.status === "eliminated" && p.eliminatedRound === round).length,
    };
  }
  const moment = sc.type === "moment" && round !== null ? meta.moments[round] : undefined;
  const winners =
    sc.type === "winners" || sc.type === "recap"
      ? game.winners().map((p, i) => ({ rank: i + 1, nickname: game.isWinnerNameHidden(p.id) ? null : p.nickname }))
      : null;
  const reveal =
    sc.type === "question" && sc.round === 5 && !game.votingOpen ? { qid: sc.qid, correct: FINALE_ANSWER_KEY[sc.qid] } : null;
  return {
    scene: sc,
    rehearsal: meta.rehearsal,
    fallback: meta.fallback,
    question,
    votingOpen: game.votingOpen,
    paused: game.paused,
    msRemaining: game.votingOpen ? game.msRemaining() : 0,
    playerCount: game.playerCount,
    results: showResults ? resultsView(game, round!) : null,
    survivors,
    moment: moment && moment !== "failed" ? moment.screen : null,
    finalistCount: game.finalists().length,
    winners,
    reveal,
  };
}

export function screenView(game: Game, meta: ServerMeta): ScreenView {
  const sc = game.scene;
  return { ...base(game, meta), kind: "screen", answered: sc.type === "question" ? game.answerCount(sc.qid) : 0 };
}

/** Work shared by every phone in one broadcast — computed once, not 400 times. */
export interface ViewContext {
  b: BaseView;
  finalists: Set<string>;
  winners: Set<string>;
  finale: Map<string, { correct: number }>;
}

export function viewContext(game: Game, meta: ServerMeta): ViewContext {
  return {
    b: base(game, meta),
    finalists: new Set(game.finalists().map((p) => p.id)),
    winners: new Set(game.winners().map((p) => p.id)),
    finale: new Map(game.finaleRanking().map((r) => [r.playerId, { correct: r.correct }])),
  };
}

export function playerView(game: Game, meta: ServerMeta, playerId: string | undefined, ctx = viewContext(game, meta)): PlayerView {
  const b = ctx.b;
  const p = playerId ? game.getPlayer(playerId) : undefined;
  const view: PlayerView = {
    ...b,
    kind: "player",
    me: null,
    myAnswer: null,
    roundCard: null,
    momentCard: null,
    wrapped: null,
    finaleScore: null,
  };
  if (!p) return view;
  const sc = game.scene;
  const isFinalist = ctx.finalists.has(p.id);
  view.me = {
    id: p.id,
    nickname: p.nickname,
    status: p.status,
    rejoinCode: p.rejoinCode,
    isFinalist,
    isWinner: ctx.winners.has(p.id),
  };
  if (sc.type === "question") view.myAnswer = game.answerOf(p.id, sc.qid) ?? null;
  const round = sceneRound(game);
  if (b.results && round !== null) {
    view.roundCard = {
      round,
      items: b.results.questions.map((q) => {
        const mine = game.answerOf(p.id, q.qid) ?? null;
        return {
          qid: q.qid,
          prompt: q.prompt,
          myOption: mine,
          myText: mine ? (q.options.find((o) => o.key === mine)?.text ?? null) : null,
          pctSame: mine && q.total > 0 ? Math.round((100 * q.counts[mine]) / q.total) : null,
          n: q.total,
        };
      }),
      survived: game.isRoundLocked(round) && sc.type !== "results" ? p.status === "active" : null,
    };
  }
  const moment = sc.type === "moment" && round !== null ? meta.moments[round] : undefined;
  if (moment && moment !== "failed") view.momentCard = moment.perPlayer(p.id);
  if (isFinalist && (sc.type === "finale_results" || sc.type === "winners" || sc.type === "recap" || sc.type === "wrapped")) {
    const r = ctx.finale.get(p.id);
    if (r) view.finaleScore = { correct: r.correct, of: 3 };
  }
  if (sc.type === "wrapped" || sc.type === "recap") view.wrapped = meta.wrapped(p.id);
  return view;
}

export function hostView(game: Game, meta: ServerMeta): HostView {
  const b = base(game, meta);
  const sc = game.scene;
  const round = sceneRound(game);
  const rankable = round !== null && round <= 4;
  const ranking = rankable ? game.roundRanking(round) : null;
  const all = game.players;
  const momentEntry = round !== null ? meta.moments[round] : undefined;
  return {
    ...b,
    kind: "host",
    answered: sc.type === "question" ? game.answerCount(sc.qid) : 0,
    host: {
      locked: round !== null && game.isRoundLocked(round),
      suggestedKeep: ranking?.suggestedKeep ?? 0,
      activeCount: all.filter((p) => p.status === "active").length,
      analystCount: all.filter((p) => p.status !== "active").length,
      tiedAtCutoff: ranking?.tiedAtCutoff ?? 0,
      finalists: game.finalists().length,
      winnersLocked: game.winnersLocked,
      winnersPreview:
        sc.type === "finale_results" || sc.type === "winners"
          ? game
              .finaleRanking()
              .slice(0, 20)
              .map((r) => ({ playerId: r.playerId, nickname: game.getPlayer(r.playerId)!.nickname, correct: r.correct, timeOnCorrectMs: r.timeOnCorrectMs }))
          : [],
      joinsLocked: meta.joinsLocked,
      sceneIndex: game.sceneIndex,
      sceneCount: SCENES.length,
      nextScene: SCENES[game.sceneIndex + 1] ?? null,
      momentStatus: momentEntry === undefined ? "none" : momentEntry === "failed" ? "failed" : "ready",
    },
  };
}
