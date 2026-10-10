import { createRoot } from "react-dom/client";
import { useEffect, useMemo, useState } from "react";
import { renderSVG } from "uqr";
import "./styles.css";
import type { CountUpdate, ScreenView } from "../../shared/views";
import type { Moment } from "../../shared/moments";
import { call, makeSocket, MOMENT_COPY, qNumber, ROUND_THEMES, useConnected, useCountdown, GROUP_HEX } from "./lib/live";
import { DotMap, LetterChip, OptionBars, PredictionBars, RibbonChart } from "./components/charts";
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
    <div className="relative flex h-screen w-screen flex-col overflow-hidden px-[4vw] py-[4vh]" data-scene="moment">
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

  if (!view) return <div className="grid h-screen place-items-center text-[3vmin] text-muted">Connecting…</div>;
  const sc = view.scene;
  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden px-[4vw] py-[4vh]" data-scene={sc.type}>
      {sc.type !== "lobby" && <TopBar view={view} players={count.players} />}
      <div className="relative flex min-h-0 flex-1 flex-col">
        {sc.type === "lobby" && <Lobby players={count.players} />}
        {sc.type === "question" && <Question view={view} stamp={stamp} answered={count.answered} players={count.players} />}
        {sc.type === "results" && <Results view={view} />}
        {sc.type === "survivors" && <Survivors view={view} />}
        {sc.type === "moment" && <MomentScene view={view} />}
        {sc.type === "finale_intro" && (
          <Big kicker="THE FINALE" title={`${view.finalistCount} finalists.`} body="Rarity got them here. Knowing data wins it. Correct and fast takes the chocolate." />
        )}
        {sc.type === "finale_results" && <Big kicker="THE FINALE" title="The results are in…" />}
        {sc.type === "winners" && <Winners view={view} />}
        {sc.type === "recap" && <Recap />}
        {sc.type === "wrapped" && <Big kicker="THANK YOU" title="Check your phone." body="Your personal DATA SURVIVOR Wrapped is ready — swipe through it and share it." />}
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
    <div className="mb-[3vh] flex items-center justify-between text-[2vmin] text-muted">
      <span className="font-display font-bold tracking-[0.14em] text-ink">
        DATA<span className="text-brand-ink">SURVIVOR</span>
      </span>
      <span className="flex items-center gap-[1vw] font-semibold tracking-[0.12em]">
        {round ? `${round === 5 ? "FINALE" : `ROUND ${round}`} · ${ROUND_THEMES[round].toUpperCase()}` : ""}
        {(view.rehearsal || view.fallback) && (
          <span className="rounded-md border border-brand/60 px-[0.8vmin] py-[0.3vmin] text-[1.5vmin] font-bold tracking-[0.18em] text-brand-ink">
            SIMULATED DATA{view.fallback ? " · FALLBACK" : ""}
          </span>
        )}
      </span>
      <span className="tabular">
        <b className="text-ink">{players}</b> playing
      </span>
    </div>
  );
}

function Big({ kicker, title, body }: { kicker: string; title: string; body?: string }) {
  return (
    <div className="rise flex flex-1 flex-col justify-center">
      <p className="text-[2.6vmin] font-bold tracking-[0.2em] text-brand-ink">{kicker}</p>
      <h1 className="font-display mt-[2vh] text-[11vmin] font-bold leading-[0.95]">{title}</h1>
      {body && <p className="mt-[3vh] max-w-[70vw] text-[3.6vmin] leading-snug text-muted">{body}</p>}
    </div>
  );
}

function Lobby({ players }: { players: number }) {
  const url = typeof location !== "undefined" ? location.origin : "";
  const svg = useMemo(() => renderSVG(url, { border: 1, ecc: "M", whiteColor: "#ffffff", blackColor: "#0e0d13" }), [url]);
  return (
    <div className="grid flex-1 grid-cols-[1.15fr_1fr] items-center gap-[5vw]">
      <div className="rise">
        <div className="flex items-center gap-[1.2vw]">
          <img src="/club-logo.jpeg" alt="" className="h-[8vmin] w-[8vmin] rounded-[1.4vmin] bg-white object-contain p-[0.3vmin]" />
          <span className="text-[2.4vmin] font-semibold text-muted">Data Science Club presents</span>
        </div>
        <h1 className="font-display mt-[3vh] text-[13vmin] font-bold leading-[0.88]">
          DATA
          <br />
          <span className="text-brand-ink">SURVIVOR</span>
        </h1>
        <p className="mt-[3vh] text-[3.4vmin] text-muted">Your generation, decoded.</p>
        <ol className="mt-[5vh] space-y-[1.6vh] text-[2.8vmin]">
          <li>
            <b className="text-brand-ink">1</b>&nbsp;&nbsp;Scan the code, pick a nickname
          </li>
          <li>
            <b className="text-brand-ink">2</b>&nbsp;&nbsp;Answer on your phone — rare answers survive
          </li>
          <li>
            <b className="text-brand-ink">3</b>&nbsp;&nbsp;Watch the room turn into data
          </li>
        </ol>
      </div>
      <div className="rise flex flex-col items-center" style={{ animationDelay: "150ms" }}>
        <div className="w-[min(36vw,58vh)] rounded-[3vmin] bg-white p-[2vmin]" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="font-display mt-[2.5vh] text-[3vmin] font-semibold">{url.replace(/^https?:\/\//, "")}</p>
        <p className="mt-[3vh] text-[2.4vmin] text-muted">
          <span data-testid="player-count" className="font-display tabular text-[7vmin] font-bold text-ink">
            {players}
          </span>
          <span className="ml-[1vw]">in the room</span>
        </p>
        <p className="mt-[1vh] text-[1.8vmin] text-faint">Slow Wi-Fi? Switch to mobile data.</p>
      </div>
    </div>
  );
}

function Question({ view, stamp, answered, players }: { view: ScreenView; stamp: number; answered: number; players: number }) {
  const q = view.question!;
  const left = useCountdown(view.msRemaining, view.votingOpen && !view.paused, stamp);
  const reveal = view.reveal?.qid === q.id ? view.reveal.correct : null;
  const label = q.round === 5 ? (q.kind === "tiebreak" ? "BONUS SPEED QUESTION" : qNumber(q.id).replace("F", "FINALE QUESTION ")) : `${qNumber(q.id)} OF 12`;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="text-[2.4vmin] font-bold tracking-[0.18em] text-brand-ink">{label}</p>
      <h1 className="font-display mt-[1.5vh] line-clamp-3 text-[5.6vmin] font-semibold leading-[1.1]">{q.prompt}</h1>
      <div className="mt-[4vh] grid min-h-0 flex-1 grid-cols-2 gap-[2vmin]">
        {q.options.map((o) => {
          const dim = reveal && reveal !== o.key;
          return (
            <div
              key={o.key}
              className={`rise flex items-center gap-[1.6vmin] rounded-[2vmin] border bg-surface px-[2vmin] py-[1.6vmin] ${dim ? "opacity-30" : ""}`}
              style={{ borderColor: reveal === o.key ? "var(--color-good)" : "var(--color-line)", borderWidth: reveal === o.key ? 3 : 1 }}
            >
              <LetterChip k={o.key} size="lg" />
              <span className="line-clamp-3 text-[3vmin] leading-snug">{o.text}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-[3vh] flex items-center gap-[2vw]">
        {view.votingOpen ? (
          <>
            <span className="font-display tabular w-[9vmin] text-[7vmin] font-bold leading-none">{view.paused ? "II" : Math.ceil(left / 1000)}</span>
            <div className="h-[1.2vmin] flex-1 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (left / 20000) * 100)}%` }} />
            </div>
          </>
        ) : (
          <span className="font-display flex-1 text-[4.4vmin] font-bold">{reveal ? `Answer: ${reveal}` : "Voting closed"}</span>
        )}
        <span className="tabular text-[2.8vmin] text-muted">
          <b className="font-display text-[4.4vmin] text-ink">{answered}</b> / {players} answered
        </span>
      </div>
    </div>
  );
}

function Results({ view }: { view: ScreenView }) {
  const r = view.results;
  if (!r) return <Big kicker="RESULTS" title="Counting…" />;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-[6vmin] font-bold">How the room answered</h1>
        <span className="tabular text-[2.4vmin] text-muted">n = {r.n}</span>
      </div>
      <div className="mt-[3vh] grid min-h-0 flex-1 grid-cols-3 gap-[3vw]">
        {r.questions.map((q, qi) => {
          const pct = Object.fromEntries(Object.entries(q.counts).map(([k, v]) => [k, q.total ? Math.round((100 * v) / q.total) : 0]));
          return (
            <div key={q.qid} className="flex min-h-0 flex-col">
              <p className="text-[2.2vmin] font-bold tracking-[0.12em] text-brand-ink">{qNumber(q.qid)}</p>
              <p className="mt-[0.8vh] line-clamp-3 min-h-[3lh] text-[2.2vmin] leading-snug text-muted">{q.prompt}</p>
              <div className="mt-[2vh]">
                <OptionBars options={q.options} pct={pct} delayMs={qi * 350} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-[2vh] text-[2.4vmin] text-muted">Rarer answers score higher. The less common your choice, the more surprising it was.</p>
    </div>
  );
}

function Survivors({ view }: { view: ScreenView }) {
  const s = view.survivors;
  if (!s) return <Big kicker="SURVIVORS" title="Locking survivors…" />;
  const final = s.round === 4;
  return (
    <div className="rise flex flex-1 flex-col justify-center">
      <p className="text-[2.6vmin] font-bold tracking-[0.2em] text-brand-ink">ROUND {s.round} · SURVIVORS</p>
      <div className="mt-[4vh] grid grid-cols-2 gap-[5vw]">
        <div>
          <p className="font-display tabular text-[20vmin] font-bold leading-none">{s.kept}</p>
          <p className="mt-[1vh] text-[3.6vmin]">{final ? "finalists" : "still in the game"}</p>
        </div>
        <div className="text-muted">
          <p className="font-display tabular text-[20vmin] font-bold leading-none">{s.eliminated}</p>
          <p className="mt-[1vh] text-[3.6vmin]">move to Analyst Mode</p>
        </div>
      </div>
      <p className="mt-[5vh] max-w-[75vw] text-[3vmin] text-muted">Rarer answers survived. Analysts keep playing — every answer still builds the charts.</p>
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
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="text-[2.6vmin] font-bold tracking-[0.2em] text-brand-ink">THE WINNERS</p>
      <h1 className="font-display mt-[1vh] text-[8vmin] font-bold leading-none">Data Survivors.</h1>
      {w.length === 0 ? (
        <p className="mt-[4vh] text-[3vmin] text-muted">No finalists this time.</p>
      ) : (
        <div className={`mt-[4vh] grid gap-x-[4vw] gap-y-[2vh] ${w.length > 5 ? "grid-cols-2" : "grid-cols-1"}`}>
          {w.map((x, k) => (
            <div key={x.rank} className="rise flex items-baseline gap-[2vmin] border-b border-line pb-[1.2vh]" style={{ animationDelay: `${400 + k * 450}ms` }}>
              <span className="font-display tabular w-[6vmin] text-[4vmin] font-bold text-brand-ink">#{x.rank}</span>
              <span className="font-display truncate text-[5vmin] font-bold">{x.nickname ?? `Winner ${x.rank}`}</span>
            </div>
          ))}
        </div>
      )}
      <p className="mt-auto pt-[2vh] text-[2.4vmin] text-muted">Winners: show your phone at the stage to collect your chocolate.</p>
    </div>
  );
}

function Recap() {
  const lines = [
    ["Spread", "Some questions split you. Others didn't."],
    ["Patterns", "Some answers went together. We checked whether it could be coincidence."],
    ["Groups", "You formed a map you didn't know you were drawing."],
    ["Prediction", "A computer tried to guess you. Sometimes it could, sometimes it couldn't."],
  ];
  return (
    <div className="flex flex-1 flex-col justify-center">
      <p className="text-[2.6vmin] font-bold tracking-[0.2em] text-brand-ink">THE ROOM, DECODED</p>
      <div className="mt-[4vh] space-y-[3vh]">
        {lines.map(([k, v], i) => (
          <div key={k} className="rise grid grid-cols-[22vmin_1fr] items-baseline gap-[2vw]" style={{ animationDelay: `${i * 500}ms` }}>
            <span className="font-display text-[4.4vmin] font-bold text-brand-ink">{k}</span>
            <span className="text-[3.6vmin] leading-snug">{v}</span>
          </div>
        ))}
      </div>
      <p className="rise mt-[6vh] max-w-[80vw] text-[3vmin] text-muted" style={{ animationDelay: "2200ms" }}>
        We didn't give you a personality. We asked questions, gathered your answers, and found patterns no single answer could show. Your answers created the dataset.
      </p>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
