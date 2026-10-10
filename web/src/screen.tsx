import { createRoot } from "react-dom/client";
import { useEffect, useMemo, useState } from "react";
import { renderSVG } from "uqr";
import "./styles.css";
import type { CountUpdate, ScreenView } from "../../shared/views";
import type { Moment } from "../../shared/moments";
import { call, makeSocket, MOMENT_COPY, OPTION_COLOR, qNumber, ROUND_THEMES, useConnected, useCountdown, GROUP_HEX } from "./lib/live";
import { DotMap, LetterChip, OptionBars, PredictionBars, RibbonChart } from "./components/charts";
import { AnswerMeter, JoinDots, ScoreHistogram } from "./components/visuals";
import FALLBACKS from "./screen/fallbackMoments.json";

const socket = makeSocket();

/** /screen?preview=1..4 — draw a data moment from the bundled simulated data (projector check, no game needed). */
function Preview({ round }: { round: number }) {
  const fake = {
    scene: { type: "moment", round },
    rehearsal: true,
    fallback: true,
    moment: null,
    playerCount: 150,
  } as unknown as ScreenView;
  return (
    <div className="stage relative flex h-screen w-screen flex-col overflow-hidden px-[4.5vw] py-[4vh]" data-scene="moment">
      <TopBar view={fake} players={150} />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <MomentScene view={fake} />
      </div>
    </div>
  );
}

function App() {
  const preview = Number(new URLSearchParams(location.search).get("preview"));
  if (preview >= 1 && preview <= 4) return <Preview round={preview} />;
  return <Live />;
}

function Live() {
  const [view, setView] = useState<ScreenView | null>(null);
  const [stamp, setStamp] = useState(0);
  const [count, setCount] = useState<CountUpdate>({ players: 0, answered: 0 });
  const connected = useConnected(socket);

  useEffect(() => {
    const onState = (v: ScreenView) => {
      setView(v);
      setStamp((s) => s + 1);
      setCount((c) => ({ players: v.playerCount, answered: v.answered ?? c.answered }));
    };
    const onCount = (c: CountUpdate) => setCount(c);
    const hello = () => call(socket, "screen:hello");
    socket.on("state", onState);
    socket.on("count", onCount);
    socket.on("connect", hello);
    if (socket.connected) hello();
    return () => {
      socket.off("state", onState);
      socket.off("count", onCount);
      socket.off("connect", hello);
    };
  }, []);

  if (!view) return <div className="stage grid h-screen place-items-center text-[3vmin] text-muted">Connecting…</div>;
  const sc = view.scene;
  return (
    <div className="stage relative flex h-screen w-screen flex-col overflow-hidden px-[4.5vw] py-[4vh]" data-scene={sc.type}>
      {sc.type !== "lobby" && <TopBar view={view} players={count.players} />}
      <div className="relative flex min-h-0 flex-1 flex-col">
        {sc.type === "lobby" && <Lobby players={count.players} />}
        {sc.type === "question" && <Question view={view} stamp={stamp} answered={count.answered} players={count.players} />}
        {sc.type === "results" && <Results view={view} />}
        {sc.type === "survivors" && <Survivors view={view} />}
        {sc.type === "moment" && <MomentScene view={view} />}
        {sc.type === "finale_intro" && <FinaleIntro count={view.finalistCount} />}
        {sc.type === "finale_results" && <Big kicker="The finale" title="The results are in…" body="Correct answers first, then speed. Winners in a moment." />}
        {sc.type === "winners" && <Winners view={view} />}
        {sc.type === "recap" && <Recap moments={(view.recap ?? []) as (Moment | null)[]} />}
        {sc.type === "wrapped" && <Big kicker="Thank you" title="Check your phone." body="Your personal DATA SURVIVOR Wrapped is ready — swipe through it and share it." />}
      </div>
      {sc.type === "lobby" && view.rehearsal && (
        <div className="pointer-events-none absolute bottom-[2vh] right-[2vw] rounded-md border border-brand/60 px-[1vw] py-[0.6vh] text-[1.6vmin] font-bold tracking-[0.2em] text-brand-ink">
          SIMULATED DATA · REHEARSAL
        </div>
      )}
      {!connected && <div data-testid="reconnecting" className="absolute left-[2vw] top-[1.5vh] text-[1.4vmin] text-faint">reconnecting…</div>}
    </div>
  );
}

function TopBar({ view, players }: { view: ScreenView; players: number }) {
  const sc = view.scene;
  const round = "round" in sc ? sc.round : null;
  return (
    <div className="mb-[3.2vh] flex items-center justify-between border-b border-line/70 pb-[1.6vh] text-[1.9vmin] text-muted">
      <span className="flex items-center gap-[1vmin]">
        <img src="/club-logo.jpeg" alt="" className="h-[3.4vmin] w-[3.4vmin] rounded-[0.7vmin] bg-white object-contain p-[0.15vmin]" />
        <span className="font-display font-bold tracking-[0.14em] text-ink">
          DATA<span className="text-brand-ink">SURVIVOR</span>
        </span>
      </span>
      <span className="flex items-center gap-[1vw] font-semibold tracking-[0.14em]">
        {round ? `${round === 5 ? "FINALE" : `ROUND ${round} / 4`} · ${ROUND_THEMES[round].toUpperCase()}` : ""}
        {(view.rehearsal || view.fallback) && (
          <span className="rounded-md border border-brand/60 px-[0.8vmin] py-[0.3vmin] text-[1.4vmin] font-bold tracking-[0.18em] text-brand-ink">
            SIMULATED DATA{view.fallback ? " · FALLBACK" : ""}
          </span>
        )}
      </span>
      <span className="tabular flex items-center gap-[0.8vmin]">
        <i className="inline-block h-[1vmin] w-[1vmin] rounded-full bg-brand" />
        <b className="font-display text-ink">{players}</b> playing
      </span>
    </div>
  );
}

function Big({ kicker, title, body }: { kicker: string; title: string; body?: string }) {
  return (
    <div className="rise flex flex-1 flex-col justify-center">
      {kicker && <p className="kicker text-[2.3vmin]">{kicker}</p>}
      <h1 className="font-display mt-[2.4vh] text-[11vmin] font-bold leading-[0.92]">{title}</h1>
      {body && <p className="mt-[3vh] max-w-[68vw] text-[3.4vmin] leading-snug text-muted">{body}</p>}
    </div>
  );
}

function Lobby({ players }: { players: number }) {
  const url = typeof location !== "undefined" ? location.origin : "";
  const svg = useMemo(() => renderSVG(url, { border: 1, ecc: "M", whiteColor: "#ffffff", blackColor: "#0b0a0f" }), [url]);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-[1.2fr_1fr] items-center gap-[5vw]">
        <div className="rise">
          <div className="flex items-center gap-[1.2vw]">
            <img src="/club-logo.jpeg" alt="" className="h-[7vmin] w-[7vmin] rounded-[1.4vmin] bg-white object-contain p-[0.3vmin]" />
            <span className="kicker text-[2vmin]">Data Science Club presents</span>
          </div>
          <h1 className="font-display mt-[3vh] text-[13vmin] font-bold leading-[0.86]">
            DATA
            <br />
            <span className="text-brand-ink">SURVIVOR</span>
          </h1>
          <p className="mt-[2.6vh] text-[3.4vmin] text-muted">Your generation, decoded.</p>
          <ol className="mt-[4.5vh] space-y-[1.8vh] text-[2.7vmin]">
            {["Scan the code, pick a nickname", "Answer on your phone — rare answers survive", "Watch the room turn into data"].map((t, i) => (
              <li key={t} className="flex items-center gap-[1.4vmin]">
                <span className="font-display grid h-[4.4vmin] w-[4.4vmin] place-items-center rounded-full bg-brand/20 text-[2.3vmin] font-bold text-brand-ink">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        </div>
        <div className="rise flex flex-col items-center" style={{ animationDelay: "150ms" }}>
          <div className="w-[min(34vw,50vh)] rounded-[3vmin] bg-white p-[1.8vmin] shadow-[0_0_0_1.2vmin_rgba(123,90,198,0.25)]" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="font-display mt-[2.6vh] text-[3vmin] font-semibold">{url.replace(/^https?:\/\//, "")}</p>
          <p className="mt-[0.8vh] text-[1.8vmin] text-faint">Slow Wi-Fi? Switch to mobile data.</p>
        </div>
      </div>
      <div className="mt-[3vh] flex items-end gap-[3vw]">
        <div className="shrink-0">
          <p data-testid="player-count" className="font-display tabular text-[9vmin] font-bold leading-none">
            {players}
          </p>
          <p className="mt-[0.6vh] text-[2.2vmin] text-muted">in the room</p>
        </div>
        <div className="h-[13vh] min-w-0 flex-1">
          <JoinDots count={players} />
        </div>
      </div>
      <p className="mt-[1vh] text-[1.6vmin] text-faint">Every dot is someone in this room.</p>
    </div>
  );
}

function Question({ view, stamp, answered, players }: { view: ScreenView; stamp: number; answered: number; players: number }) {
  const q = view.question!;
  const left = useCountdown(view.msRemaining, view.votingOpen && !view.paused, stamp);
  const reveal = view.reveal?.qid === q.id ? view.reveal.correct : null;
  const label = q.round === 5 ? (q.kind === "tiebreak" ? "Bonus speed question" : qNumber(q.id).replace("F", "Finale question ")) : `Question ${q.id.slice(1)} of 12`;
  const secs = Math.ceil(left / 1000);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="kicker text-[2.1vmin]">{label}</p>
      <h1 className="font-display mt-[1.6vh] line-clamp-3 max-w-[88vw] text-[5.4vmin] font-semibold leading-[1.08]">{q.prompt}</h1>
      <div className="mt-[3.6vh] grid min-h-0 flex-1 grid-cols-2 gap-[1.8vmin]">
        {q.options.map((o, i) => {
          const dim = reveal && reveal !== o.key;
          const right = reveal === o.key;
          return (
            <div
              key={o.key}
              className={`card rise relative flex items-center gap-[2vmin] overflow-hidden rounded-[2vmin] px-[2.4vmin] py-[1.6vmin] ${dim ? "opacity-25" : ""}`}
              style={{ animationDelay: `${i * 80}ms`, borderColor: right ? "var(--color-good)" : undefined, borderWidth: right ? 3 : undefined }}
            >
              <span className="absolute inset-y-0 left-0 w-[0.7vmin]" style={{ background: OPTION_COLOR[o.key] }} />
              <LetterChip k={o.key} size="lg" />
              <span className="line-clamp-3 text-[2.9vmin] leading-snug">{o.text}</span>
              {right && <span className="font-display ml-auto text-[3vmin] font-bold text-[#7fe07f]">✓</span>}
            </div>
          );
        })}
      </div>
      <div className="mt-[2.8vh] flex h-[11vmin] items-center gap-[2.4vw]">
        {view.votingOpen ? (
          <>
            <span className={`font-display tabular w-[10vmin] text-[8vmin] font-bold leading-none ${secs <= 5 && !view.paused ? "text-[#ff8f8f]" : ""}`}>
              {view.paused ? "II" : secs}
            </span>
            <div className="h-[1.1vmin] flex-1 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (left / 20000) * 100)}%` }} />
            </div>
          </>
        ) : (
          <span className="font-display flex-1 text-[4.4vmin] font-bold">{reveal ? `The answer is ${reveal}` : "Voting closed"}</span>
        )}
        <span className="tabular text-right text-[2.3vmin] leading-tight text-muted">
          <b className="font-display block text-[4.2vmin] text-ink">{answered}</b>of {players}
        </span>
        <AnswerMeter answered={answered} players={players} />
      </div>
    </div>
  );
}

function Results({ view }: { view: ScreenView }) {
  const r = view.results;
  if (!r) return <Big kicker="Results" title="Counting…" />;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-end justify-between">
        <div>
          <p className="kicker text-[2.1vmin]">Round {r.round} results</p>
          <h1 className="font-display mt-[1vh] text-[6vmin] font-bold leading-none">How the room answered</h1>
        </div>
        <span className="tabular rounded-full border border-line px-[1.4vmin] py-[0.5vmin] text-[2vmin] text-muted">n = {r.n}</span>
      </div>
      <div className="mt-[3.4vh] grid min-h-0 flex-1 grid-cols-3 gap-[2vw]">
        {r.questions.map((q, qi) => {
          const pct = Object.fromEntries(Object.entries(q.counts).map(([k, v]) => [k, q.total ? Math.round((100 * v) / q.total) : 0]));
          return (
            <div key={q.qid} className="card rise flex min-h-0 flex-col rounded-[2vmin] p-[2.2vmin]" style={{ animationDelay: `${qi * 150}ms` }}>
              <p className="font-display text-[2.6vmin] font-bold text-brand-ink">{qNumber(q.qid)}</p>
              <p className="mt-[0.6vh] line-clamp-3 min-h-[3lh] text-[2vmin] leading-snug text-muted">{q.prompt}</p>
              <div className="mt-[2.2vh]">
                <OptionBars options={q.options} pct={pct} delayMs={300 + qi * 350} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-[2.2vh] text-[2.3vmin] text-muted">The less common your choice, the higher your rarity score.</p>
    </div>
  );
}

function Survivors({ view }: { view: ScreenView }) {
  const s = view.survivors;
  if (!s) return <Big kicker="Survivors" title="Locking survivors…" />;
  const final = s.round === 4;
  return (
    <div className="rise grid min-h-0 flex-1 grid-cols-[0.8fr_1.4fr] items-center gap-[4vw]">
      <div>
        <p className="kicker text-[2.1vmin]">Round {s.round} · survivors</p>
        <p className="font-display tabular mt-[2vh] text-[17vmin] font-bold leading-[0.9]">{s.kept}</p>
        <p className="mt-[1vh] text-[3.2vmin]">{final ? "finalists" : "still in the game"}</p>
        <p className="font-display tabular mt-[4vh] text-[8vmin] font-bold leading-none text-muted">{s.eliminated}</p>
        <p className="mt-[0.8vh] text-[2.6vmin] text-muted">move to Analyst Mode</p>
      </div>
      <div className="flex h-full min-h-0 flex-col justify-center">
        {s.histogram ? (
          <>
            <p className="text-[2.4vmin] text-muted">Everyone's rarity score this round</p>
            <div className="mt-[2vh] min-h-0 flex-1">
              <ScoreHistogram bins={s.histogram.bins} kept={s.histogram.kept} />
            </div>
            <div className="mt-[1.6vh] flex flex-wrap items-center gap-x-[2.4vmin] gap-y-[0.8vh] text-[2.2vmin] text-muted">
              <span className="flex items-center gap-[0.8vmin]">
                <i className="inline-block h-[1.6vmin] w-[1.6vmin] rounded-[0.3vmin] bg-brand" /> survived
              </span>
              <span className="flex items-center gap-[0.8vmin]">
                <i className="inline-block h-[1.6vmin] w-[1.6vmin] rounded-[0.3vmin] bg-faint/60" /> moved to Analyst Mode
              </span>
              <span className="text-faint">Ties went to the faster answer.</span>
            </div>
          </>
        ) : (
          <p className="text-[3vmin] text-muted">Rarer answers survived. Analysts keep playing — every answer still builds the charts.</p>
        )}
      </div>
    </div>
  );
}

function FinaleIntro({ count }: { count: number }) {
  return (
    <div className="rise grid flex-1 grid-cols-[1.2fr_1fr] items-center gap-[4vw]">
      <div>
        <p className="kicker text-[2.3vmin]">The finale</p>
        <h1 className="font-display mt-[2.4vh] text-[12vmin] font-bold leading-[0.9]">{count} finalists.</h1>
        <p className="mt-[3vh] max-w-[50vw] text-[3.2vmin] leading-snug text-muted">
          Rarity got them here. <span className="text-ink">Knowing data wins it.</span> Three questions with right answers, plus a bonus speed round. Correct and fast takes the chocolate.
        </p>
      </div>
      <div className="flex flex-wrap content-center gap-[1.6vmin]">
        {Array.from({ length: Math.min(count, 40) }, (_, i) => (
          <span key={i} className="pop h-[5.5vmin] w-[5.5vmin] rounded-full bg-brand" style={{ animationDelay: `${300 + i * 60}ms` }} />
        ))}
      </div>
    </div>
  );
}

function MomentScene({ view }: { view: ScreenView }) {
  const round = view.scene.type === "moment" ? view.scene.round : 1;
  const copy = MOMENT_COPY[round];
  const m = (view.fallback ? (FALLBACKS as Record<string, unknown>)[String(round)] : view.moment) as Moment | null;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-baseline justify-between gap-[2vw]">
        <div>
          <p className="text-[2.2vmin] font-bold tracking-[0.2em] text-brand-ink">DATA MOMENT {round}</p>
          <h1 className="font-display mt-[0.6vh] text-[6.4vmin] font-bold leading-none">{copy.ask}</h1>
        </div>
        {m && <span className="tabular shrink-0 text-[2.4vmin] text-muted">n = {m.n}</span>}
      </div>
      <div className="mt-[3vh] flex min-h-0 flex-1 flex-col">{m ? <MomentBody m={m} /> : <Big kicker="" title="Crunching the numbers…" />}</div>
      <div className="mt-[2vh] grid grid-cols-[1fr_auto] items-end gap-[3vw] border-t border-line pt-[1.6vh]">
        <p className="text-[2.6vmin] leading-snug">
          <b className="text-brand-ink">The idea:</b> {copy.idea}
        </p>
        <p className="max-w-[38vw] text-right text-[2vmin] leading-snug text-muted">{copy.world}</p>
      </div>
    </div>
  );
}

function MomentBody({ m }: { m: Moment }) {
  if (m.kind === "too_few") return <Big kicker="" title="Not enough answers yet." body={m.sentence} />;
  if (m.kind === "spread")
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-[3vw]">
          {m.questions.map((q, qi) => (
            <div key={q.qid} className="min-h-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[2.2vmin] font-bold text-muted">Q{q.num}</span>
                <span
                  className={`rounded-full px-[1vmin] py-[0.3vmin] text-[1.7vmin] font-semibold ${q.label === "near-even split" ? "bg-brand text-white" : q.label === "strong favourite" ? "bg-ink text-bg" : "bg-surface-2 text-ink"}`}
                >
                  {q.label}
                </span>
              </div>
              <p className="mt-[0.8vh] line-clamp-2 text-[2vmin] text-muted">{q.prompt}</p>
              <div className="mt-[1.6vh]">
                <OptionBars options={q.options} pct={q.pct} delayMs={qi * 300} />
              </div>
              <p className="mt-[1vh] text-[1.6vmin] text-faint">± {q.moe} points if a different room walked in</p>
            </div>
          ))}
        </div>
        <p className="font-display mt-[2vh] text-[3.2vmin] font-semibold">{m.callout}</p>
      </div>
    );
  if (m.kind === "pattern")
    return m.best ? (
      <div className="grid min-h-0 flex-1 grid-cols-[1.25fr_1fr] gap-[3vw]">
        <div className="min-h-0">
          <RibbonChart matrix={m.best.matrix} optA={m.best.optA} optB={m.best.optB} labelA={`Q${m.best.numA}`} labelB={`Q${m.best.numB}`} />
        </div>
        <div className="rise flex flex-col justify-center" style={{ animationDelay: "1100ms" }}>
          <p className="font-display text-[4vmin] font-semibold leading-tight">
            People who chose <span className="text-brand-ink">“{m.best.textA}”</span> on Q{m.best.numA} were{" "}
            <span className="whitespace-nowrap">{m.best.lift.toFixed(1)}× as likely</span> to choose <span className="text-brand-ink">“{m.best.textB}”</span> on Q
            {m.best.numB}.
          </p>
          <p className="mt-[2vh] text-[2.4vmin] text-muted">
            {m.best.pctBGivenA}% of them did, versus {m.best.pctB}% of everyone. ({m.best.countBoth} people)
          </p>
          <span className={`mt-[2.4vh] w-fit rounded-full px-[1.4vmin] py-[0.6vmin] text-[2vmin] font-semibold ${m.best.likelyReal ? "bg-brand text-white" : "bg-surface-2 text-muted"}`}>
            {m.best.likelyReal ? "Likely real — passed the shuffle check" : "Could be chance — failed the shuffle check"}
          </span>
          <p className="mt-[2vh] text-[2vmin] text-faint">Patterns in a small room can be coincidence.</p>
        </div>
      </div>
    ) : (
      <Big kicker="" title="No strong patterns." body={m.sentence} />
    );
  if (m.kind === "groups")
    return (
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] gap-[3vw]">
        <div className="mx-auto aspect-square h-full max-w-full min-h-0 overflow-hidden rounded-[2vmin] border border-line bg-surface">
          <DotMap points={m.points} dotScale={1.2} />
        </div>
        <div className="flex min-h-0 flex-col justify-center">
          {m.groups.length ? (
            <div className="space-y-[2.2vh]">
              {m.groups.map((g, k) => (
                <div key={g.id} className="rise flex items-start gap-[1.2vmin]" style={{ animationDelay: `${1500 + k * 250}ms` }}>
                  <span className="mt-[0.6vmin] h-[2.4vmin] w-[2.4vmin] shrink-0 rounded-full" style={{ background: GROUP_HEX[g.id % GROUP_HEX.length] }} />
                  <div>
                    <p className="font-display text-[2.8vmin] font-semibold">
                      Group {k + 1} <span className="text-muted">· {g.size} people</span>
                    </p>
                    <p className="text-[2.2vmin] leading-snug text-muted">{g.label ?? "Too small to describe (under 5 people)"}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <p className="mt-[3vh] text-[2.6vmin] leading-snug">{m.sentence}</p>
          <p className="mt-[1.6vh] text-[2vmin] text-faint">Groups describe answer patterns, not personality types. Look at your phone: you're on this map.</p>
        </div>
      </div>
    );
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[1.2fr_1fr] items-center gap-[4vw]">
      <PredictionBars lazy={m.lazyPct} smart={m.smartPct} />
      <div className="rise" style={{ animationDelay: "1500ms" }}>
        <p className="text-[2.4vmin] text-muted">Guessing everyone's answer to Q{m.num} — without ever looking at it.</p>
        <p className="font-display mt-[2vh] text-[4vmin] font-semibold leading-tight">{m.sentence}</p>
      </div>
    </div>
  );
}

function Winners({ view }: { view: ScreenView }) {
  const w = view.winners ?? [];
  const podium = w.slice(0, 3);
  const rest = w.slice(3);
  const order = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium;
  const height: Record<number, string> = { 1: "100%", 2: "72%", 3: "52%" };
  const name = (x: { rank: number; nickname: string | null }) => x.nickname ?? `Winner ${x.rank}`;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="kicker text-[2.3vmin]">The winners</p>
      <h1 className="font-display mt-[1vh] text-[7.5vmin] font-bold leading-none">Data Survivors.</h1>
      {w.length === 0 ? (
        <p className="mt-[4vh] text-[3vmin] text-muted">No finalists this time.</p>
      ) : (
        <div className="mt-[3vh] grid min-h-0 flex-1 grid-cols-[1.3fr_1fr] gap-[4vw]">
          <div className="flex min-h-0 items-end justify-center gap-[1.6vw]">
            {order.map((x, k) => (
              <div key={x.rank} className="flex h-full w-1/3 flex-col justify-end">
                <p className="rise font-display mb-[1.2vh] truncate text-center text-[3.6vmin] font-bold" style={{ animationDelay: `${1200 + k * 400}ms` }}>
                  {name(x)}
                </p>
                <div
                  className="grow-y flex items-start justify-center rounded-t-[1.6vmin] pt-[1.6vh]"
                  style={{ height: height[x.rank], background: x.rank === 1 ? "var(--color-brand)" : "var(--color-surface-2)", animationDelay: `${300 + k * 250}ms` }}
                >
                  <span className="font-display text-[6vmin] font-bold">{x.rank}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex min-h-0 flex-col justify-end gap-[1.2vh] overflow-hidden">
            {rest.map((x, k) => (
              <div key={x.rank} className="rise flex items-baseline gap-[1.6vmin] border-b border-line pb-[1vh]" style={{ animationDelay: `${2000 + k * 250}ms` }}>
                <span className="font-display tabular w-[5vmin] text-[2.6vmin] font-bold text-brand-ink">#{x.rank}</span>
                <span className="font-display truncate text-[3.2vmin] font-semibold">{name(x)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="mt-[2vh] text-[2.2vmin] text-muted">Winners: show your phone at the stage to collect your chocolate.</p>
    </div>
  );
}

function Thumb({ m }: { m: Moment | null }) {
  if (!m || m.kind === "too_few") return <p className="text-[1.8vmin] text-faint">{m ? "Not enough answers for this chart." : "Not available."}</p>;
  if (m.kind === "spread") {
    const q = [...m.questions].sort((a, b) => Math.max(...Object.values(a.pct)) - Math.max(...Object.values(b.pct)))[0];
    return (
      <div className="flex h-full items-end gap-[0.8vmin]">
        {(["A", "B", "C", "D"] as const).map((k) => (
          <div key={k} className="grow-y flex-1 rounded-t-[0.5vmin]" style={{ height: `${Math.max(q.pct[k], 3)}%`, background: OPTION_COLOR[k] }} />
        ))}
      </div>
    );
  }
  if (m.kind === "pattern")
    return m.best ? (
      <RibbonChart matrix={m.best.matrix} optA={m.best.optA} optB={m.best.optB} labelA="" labelB="" />
    ) : (
      <p className="text-[1.8vmin] text-faint">No strong pattern.</p>
    );
  if (m.kind === "groups") return <DotMap points={m.points} dotScale={0.7} />;
  return (
    <div className="flex h-full flex-col justify-center gap-[1vh]">
      {[
        { v: m.lazyPct, c: "var(--color-faint)" },
        { v: m.smartPct, c: "var(--color-brand)" },
      ].map((b, i) => (
        <div key={i} className="h-[2.2vmin] overflow-hidden rounded-[0.4vmin] bg-surface-2">
          <div className="grow-x h-full" style={{ width: `${b.v}%`, background: b.c }} />
        </div>
      ))}
    </div>
  );
}

function Recap({ moments }: { moments: (Moment | null)[] }) {
  const lines: [string, string][] = [
    ["Spread", "Some questions split you. Others didn't."],
    ["Patterns", "Some answers went together — we checked if it was chance."],
    ["Groups", "You formed a map you didn't know you were drawing."],
    ["Prediction", "A computer tried to guess you. Sometimes it could."],
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="kicker text-[2.3vmin]">The room, decoded</p>
      <div className="mt-[3vh] grid min-h-0 flex-1 grid-cols-4 gap-[1.6vw]" data-testid="recap-thumbs">
        {lines.map(([k, v], i) => (
          <div key={k} className="card rise flex min-h-0 flex-col rounded-[2vmin] p-[2vmin]" style={{ animationDelay: `${i * 450}ms` }}>
            <p className="font-display text-[3.4vmin] font-bold text-brand-ink">{k}</p>
            <div className="mt-[1.6vh] min-h-0 flex-1">
              <Thumb m={moments[i] ?? null} />
            </div>
            <p className="mt-[1.6vh] text-[2.2vmin] leading-snug">{v}</p>
          </div>
        ))}
      </div>
      <p className="rise mt-[3vh] max-w-[82vw] text-[2.8vmin] leading-snug text-muted" style={{ animationDelay: "2000ms" }}>
        We didn't give you a personality. We asked questions, gathered your answers, and found patterns no single answer could show.{" "}
        <span className="text-ink">Your answers created the dataset.</span>
      </p>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
