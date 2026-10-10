import { createRoot } from "react-dom/client";
import { useCallback, useEffect, useState } from "react";
import "./styles.css";
import type { PlayerView } from "../../shared/views";
import type { MomentCard } from "../../shared/moments";
import { call, makeSocket, MOMENT_COPY, OPTION_COLOR, qNumber, ROUND_THEMES, storage, useConnected, useCountdown } from "./lib/live";
import { DotMap, LetterChip } from "./components/charts";
import { Wrapped } from "./play/Wrapped";

const socket = makeSocket();
const TOKEN = "ds_token";

const JOIN_ERRORS: Record<string, string> = {
  ROOM_FULL: "The room is full right now.",
  JOINS_LOCKED: "Joining is closed for this game. You can still watch the big screen!",
  RATE_LIMITED: "Slow down a little and try again.",
  TIMEOUT: "Network is slow. Try again, or switch to mobile data.",
  UNKNOWN_PLAYER: "That code didn't match anyone. Check the 4 characters.",
};

function App() {
  const [view, setView] = useState<PlayerView | null>(null);
  const [stamp, setStamp] = useState(0);
  const [joined, setJoined] = useState(!!storage.get(TOKEN));
  const connected = useConnected(socket);

  useEffect(() => {
    const onState = (v: PlayerView) => {
      setView(v);
      setStamp((s) => s + 1);
    };
    const onConnect = async () => {
      const token = storage.get(TOKEN);
      if (!token) return;
      const r = await call(socket, "player:resume", { token });
      if (!r.ok && r.error === "UNKNOWN_PLAYER") {
        storage.remove(TOKEN);
        setJoined(false);
      }
    };
    socket.on("state", onState);
    socket.on("connect", onConnect);
    if (socket.connected) onConnect();
    return () => {
      socket.off("state", onState);
      socket.off("connect", onConnect);
    };
  }, []);

  // The game was reset (or we were forgotten): back to the join screen.
  useEffect(() => {
    if (joined && view && !view.me) {
      storage.remove(TOKEN);
      setJoined(false);
    }
  }, [joined, view]);

  useWakeLock(joined);

  const onJoined = useCallback((token: string) => {
    storage.set(TOKEN, token);
    setJoined(true);
  }, []);

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-[520px] flex-col px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-[max(12px,env(safe-area-inset-top))]">
      {view?.rehearsal && joined && (
        <div className="-mx-4 mb-2 bg-brand/20 py-1 text-center text-[11px] font-semibold tracking-[0.18em] text-brand-ink">REHEARSAL · SIMULATED DATA</div>
      )}
      {!connected && joined && (
        <div data-testid="reconnecting" className="-mx-4 mb-2 bg-surface-2 py-1.5 text-center text-xs text-muted" role="status">
          Reconnecting… your answers are safe.
        </div>
      )}
      {!joined || !view?.me ? <Join onJoined={onJoined} /> : <Game view={view} stamp={stamp} />}
    </div>
  );
}

function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    const get = async () => {
      try {
        lock = await (navigator as any).wakeLock.request("screen");
      } catch {
        /* not allowed — fine */
      }
    };
    get();
    const onVis = () => document.visibilityState === "visible" && get();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release().catch(() => {});
    };
  }, [active]);
}

function Header({ view }: { view: PlayerView }) {
  const me = view.me!;
  const pill = me.isWinner ? "Winner" : me.isFinalist ? "Finalist" : me.status === "active" ? "In the game" : "Analyst Mode";
  const hot = me.isWinner || me.isFinalist || me.status === "active";
  return (
    <header className="flex items-center justify-between py-2">
      <span className="font-display text-sm font-bold tracking-[0.14em]">
        DATA<span className="text-brand-ink">SURVIVOR</span>
      </span>
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${hot ? "bg-brand text-white" : "bg-surface-2 text-muted"}`}>{pill}</span>
    </header>
  );
}

function Join({ onJoined }: { onJoined: (token: string) => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"join" | "code">("join");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = mode === "join" ? await call(socket, "player:join", { nickname: name }) : await call(socket, "player:resume", { code });
    setBusy(false);
    if (r.ok) onJoined(r.token);
    else setError(JOIN_ERRORS[r.error] ?? "Something went wrong. Try again.");
  };

  return (
    <main className="flex flex-1 flex-col" data-scene="join">
      <div className="mt-[6vh] flex items-center gap-3">
        <img src="/club-logo.jpeg" alt="Data Science Club" className="h-12 w-12 rounded-xl bg-white object-contain p-0.5" />
        <span className="text-sm font-medium text-muted">Data Science Club</span>
      </div>
      <h1 className="font-display mt-6 text-[44px] font-bold leading-[0.95]">
        DATA
        <br />
        <span className="text-brand-ink">SURVIVOR</span>
      </h1>
      <p className="mt-3 text-lg text-muted">Your generation, decoded.</p>

      <form onSubmit={submit} className="mt-auto space-y-3 pb-2 pt-10">
        {mode === "join" ? (
          <>
            <label htmlFor="nick" className="block text-sm font-medium text-muted">
              Pick a nickname
            </label>
            <input
              id="nick"
              data-testid="join-nickname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={16}
              autoComplete="off"
              autoCapitalize="words"
              enterKeyHint="go"
              placeholder="e.g. Byte Me"
              className="h-14 w-full rounded-2xl border border-line bg-surface px-4 text-lg outline-none placeholder:text-faint focus:border-brand"
            />
          </>
        ) : (
          <>
            <label htmlFor="code" className="block text-sm font-medium text-muted">
              Your 4-character rejoin code
            </label>
            <input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="K7QX"
              className="font-display h-14 w-full rounded-2xl border border-line bg-surface px-4 text-center text-2xl tracking-[0.4em] outline-none placeholder:text-faint focus:border-brand"
            />
          </>
        )}
        {error && (
          <p className="text-sm text-[#ff8f8f]" role="alert">
            {error}
          </p>
        )}
        <button
          data-testid="join-submit"
          disabled={busy || (mode === "join" ? !name.trim() : code.length !== 4)}
          className="font-display h-14 w-full rounded-2xl bg-brand text-lg font-bold text-white transition active:scale-[0.98] disabled:opacity-40"
        >
          {busy ? "Joining…" : mode === "join" ? "Join the game" : "Rejoin"}
        </button>
        <button type="button" onClick={() => (setMode(mode === "join" ? "code" : "join"), setError(null))} className="w-full py-2 text-sm text-muted underline underline-offset-4">
          {mode === "join" ? "Got logged out? Rejoin with your code" : "New here? Join with a nickname"}
        </button>
        <p className="pt-2 text-xs leading-relaxed text-faint">
          Your answers are anonymous and only used for live group charts. No names appear on the big screen except winners. Data is deleted after the event.
        </p>
      </form>
    </main>
  );
}

function Game({ view, stamp }: { view: PlayerView; stamp: number }) {
  const sc = view.scene;
  return (
    <main className="flex flex-1 flex-col" data-scene={sc.type}>
      <Header view={view} />
      <div className="flex flex-1 flex-col">
        {sc.type === "lobby" && <Lobby view={view} />}
        {sc.type === "question" && <Question view={view} stamp={stamp} />}
        {sc.type === "results" && <Results view={view} />}
        {sc.type === "survivors" && <Survivors view={view} />}
        {sc.type === "moment" && <Moment view={view} />}
        {sc.type === "finale_intro" && <FinaleIntro view={view} />}
        {sc.type === "finale_results" && <FinaleResults view={view} />}
        {sc.type === "winners" && <Winners view={view} />}
        {(sc.type === "recap" || sc.type === "wrapped") &&
          (view.wrapped ? <Wrapped data={view.wrapped as any} /> : <Center title="Your Wrapped is loading…" body="Look up at the big screen for a moment." />)}
      </div>
    </main>
  );
}

function Center({ title, body, kicker }: { title: React.ReactNode; body?: React.ReactNode; kicker?: string }) {
  return (
    <div className="rise flex flex-1 flex-col justify-center pb-[10vh]">
      {kicker && <p className="mb-3 text-sm font-semibold tracking-[0.14em] text-brand-ink">{kicker}</p>}
      <h2 className="font-display text-[34px] font-bold leading-[1.05]">{title}</h2>
      {body && <div className="mt-4 text-lg leading-snug text-muted">{body}</div>}
    </div>
  );
}

function Lobby({ view }: { view: PlayerView }) {
  const me = view.me!;
  return (
    <div className="rise flex flex-1 flex-col justify-center pb-[8vh]">
      <p className="text-sm font-semibold tracking-[0.14em] text-brand-ink">YOU'RE IN</p>
      <h2 className="font-display mt-2 break-words text-[40px] font-bold leading-none">{me.nickname}</h2>
      <p className="mt-5 text-lg text-muted">Keep this tab open. The game starts on the big screen.</p>
      <div className="mt-8 rounded-2xl border border-line bg-surface p-4">
        <p className="text-sm text-muted">Your rejoin code (if you get logged out)</p>
        <p className="font-display mt-1 text-3xl font-bold tracking-[0.3em]" data-testid="rejoin-code">
          {me.rejoinCode}
        </p>
      </div>
      <p className="mt-6 text-sm text-faint">Rare answers survive. There are no right answers until the finale.</p>
    </div>
  );
}

function Timer({ view, stamp }: { view: PlayerView; stamp: number }) {
  const left = useCountdown(view.msRemaining, view.votingOpen && !view.paused, stamp);
  const secs = Math.ceil(left / 1000);
  return (
    <div className="flex items-center gap-3" aria-live="off">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (left / 20000) * 100)}%` }} />
      </div>
      <span className={`font-display tabular w-10 text-right text-lg font-bold ${secs <= 5 ? "text-[#ff8f8f]" : ""}`}>{view.paused ? "II" : secs}</span>
    </div>
  );
}

function Question({ view, stamp }: { view: PlayerView; stamp: number }) {
  const q = view.question!;
  const me = view.me!;
  const [local, setLocal] = useState<Record<string, string>>({});
  const [note, setNote] = useState<string | null>(null);
  const mine = view.myAnswer ?? local[q.id] ?? null;
  const finale = q.round === 5;

  useEffect(() => setNote(null), [q.id]);

  const answer = async (key: string) => {
    if (mine || !view.votingOpen) return;
    setLocal((l) => ({ ...l, [q.id]: key }));
    if (navigator.vibrate) navigator.vibrate(20);
    let r = await call(socket, "player:answer", { qid: q.id, option: key });
    if (!r.ok && (r.error === "TIMEOUT" || r.error === "RATE_LIMITED")) {
      await new Promise((res) => setTimeout(res, 800));
      r = await call(socket, "player:answer", { qid: q.id, option: key });
    }
    if (r.ok) setLocal((l) => ({ ...l, [q.id]: r.option }));
    else {
      setLocal((l) => {
        const { [q.id]: _, ...rest } = l;
        return rest;
      });
      setNote(r.error === "NOT_OPEN" ? "Too late — voting just closed." : r.error === "PAUSED" ? "Paused — try again in a moment." : "Didn't go through. Tap again.");
    }
  };

  const kicker = finale ? (q.kind === "tiebreak" ? "FINALE · BONUS SPEED QUESTION" : `FINALE · ${qNumber(q.id)}`) : `ROUND ${q.round} · ${ROUND_THEMES[q.round].toUpperCase()}`;
  const reveal = view.reveal?.qid === q.id ? view.reveal.correct : null;

  return (
    <div className="flex flex-1 flex-col">
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between text-xs font-semibold tracking-[0.12em] text-muted">
          <span>{kicker}</span>
          {!finale && <span>{qNumber(q.id)} / 12</span>}
        </div>
        {view.votingOpen ? <Timer view={view} stamp={stamp} /> : <p className="text-sm font-semibold text-muted">Voting closed</p>}
      </div>
      {me.status !== "active" && !finale && <p className="mt-3 rounded-xl bg-surface px-3 py-2 text-xs text-muted">Analyst Mode — you can't win, but your answers still build the charts.</p>}
      {finale && !me.isFinalist && <p className="mt-3 rounded-xl bg-surface px-3 py-2 text-xs text-muted">Play along — only finalists compete for prizes.</p>}

      <h2 className="font-display mt-4 text-[clamp(20px,6vw,26px)] font-semibold leading-tight">{q.prompt}</h2>

      <div className="mt-5 flex flex-col gap-2.5 pb-2">
        {q.options.map((o) => {
          const chosen = mine === o.key;
          const correct = reveal === o.key;
          const dim = (mine && !chosen && !correct) || (!view.votingOpen && !chosen && !correct);
          const show = view.votingOpen && !mine;
          return (
            <button
              key={o.key}
              data-testid={show ? `option-${o.key}` : undefined}
              onClick={() => answer(o.key)}
              disabled={!view.votingOpen || !!mine}
              aria-pressed={chosen}
              className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border bg-surface px-3 py-3 text-left transition active:scale-[0.98] ${dim ? "opacity-35" : ""}`}
              style={{ borderColor: chosen || correct ? OPTION_COLOR[o.key] : "var(--color-line)", boxShadow: chosen ? `inset 0 0 0 2px ${OPTION_COLOR[o.key]}` : undefined }}
            >
              <LetterChip k={o.key} />
              <span className="flex-1 text-[15px] leading-snug">{o.text}</span>
              {chosen && <span className="text-xs font-bold tracking-wider text-ink">YOU</span>}
              {correct && <span className="text-xs font-bold tracking-wider text-good">✓</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-auto pt-3">
        {mine && view.votingOpen && (
          <p data-testid="locked-in" className="font-display text-center text-lg font-semibold">
            Locked in: {mine}
          </p>
        )}
        {mine && !view.votingOpen && !reveal && (
          <p data-testid="locked-in" className="text-center text-muted">
            You chose {mine}. Results soon.
          </p>
        )}
        {!mine && !view.votingOpen && <p className="text-center text-muted">You didn't answer this one.</p>}
        {reveal && mine && (
          <p className="font-display text-center text-xl font-bold">{mine === reveal ? "Correct!" : `Not this time — it was ${reveal}.`}</p>
        )}
        {note && (
          <p className="mt-2 text-center text-sm text-[#ff8f8f]" role="alert">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}

function Results({ view }: { view: PlayerView }) {
  const card = view.roundCard;
  if (!card) return <Center title="Counting…" />;
  return (
    <div className="rise flex flex-1 flex-col pt-2">
      <p className="text-sm font-semibold tracking-[0.14em] text-brand-ink">ROUND {card.round} · YOUR ANSWERS</p>
      <div className="mt-4 space-y-3">
        {card.items.map((it) => (
          <div key={it.qid} className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-xs font-semibold text-muted">{qNumber(it.qid)}</p>
            {it.myOption ? (
              <>
                <div className="mt-1 flex items-start gap-2">
                  <LetterChip k={it.myOption} size="sm" />
                  <p className="text-[15px] leading-snug">{it.myText}</p>
                </div>
                <p className="font-display mt-3 text-[28px] font-bold leading-none">
                  {it.pctSame}%<span className="ml-2 text-base font-medium text-muted">of the room chose the same</span>
                </p>
              </>
            ) : (
              <p className="mt-1 text-muted">You skipped this one.</p>
            )}
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-faint">The rarer your answers, the higher your score. Survivors next…</p>
    </div>
  );
}

function Survivors({ view }: { view: PlayerView }) {
  const me = view.me!;
  const card = view.roundCard;
  const round = view.scene.type === "survivors" ? view.scene.round : 0;
  if (card?.survived === true)
    return <Center kicker={`ROUND ${round}`} title={<>You survived.</>} body={round === 4 ? "You're a finalist. The finale has right answers — knowing data wins it." : "Your answers were rare enough. Next round soon."} />;
  if (me.status === "eliminated" && card?.survived === false)
    return (
      <Center
        kicker={`ROUND ${round}`}
        title="Out of the race — into Analyst Mode."
        body="Your answers weren't rare enough this time. Keep playing: every tap still builds the charts, and your Wrapped is coming."
      />
    );
  return <Center kicker="ANALYST MODE" title={`${view.survivors?.kept ?? "Some"} players are still in.`} body="Keep answering — the data moments need everyone." />;
}

function Moment({ view }: { view: PlayerView }) {
  const round = view.scene.type === "moment" ? view.scene.round : 1;
  const copy = MOMENT_COPY[round];
  const card = view.momentCard as MomentCard | null;
  return (
    <div className="rise flex flex-1 flex-col pt-2" data-testid="moment-card">
      <p className="text-sm font-semibold tracking-[0.14em] text-brand-ink">DATA MOMENT {round}</p>
      <h2 className="font-display mt-2 text-[30px] font-bold leading-tight">{copy.ask}</h2>
      <div className="mt-6 flex-1">
        {!card || card.kind === "none" ? (
          <p className="text-lg text-muted">{card?.kind === "none" ? card.reason : "Look up at the big screen."}</p>
        ) : card.kind === "spread" ? (
          <div>
            <p className="font-display text-[64px] font-bold leading-none">{card.pct}%</p>
            <p className="mt-2 text-lg text-muted">of the room chose your answer to Q{card.num}:</p>
            <p className="mt-3 rounded-2xl bg-surface p-4 text-[15px]">“{card.text}”</p>
          </div>
        ) : card.kind === "pattern" ? (
          <div>
            {card.fewerThan5 ? (
              <p className="font-display text-[34px] font-bold leading-tight">Fewer than 5 people answered Q{card.numA} and Q{card.numB} like you.</p>
            ) : (
              <>
                <p className="font-display text-[64px] font-bold leading-none">{card.same}</p>
                <p className="mt-2 text-lg text-muted">
                  people ({card.pct}%) answered both Q{card.numA} and Q{card.numB} exactly like you.
                </p>
              </>
            )}
          </div>
        ) : card.kind === "groups" ? (
          <GroupsCard card={card} view={view} />
        ) : (
          <div>
            <p className="font-display text-[64px] font-bold leading-none">
              {card.same}
              <span className="text-3xl text-muted"> / {card.k}</span>
            </p>
            <p className="mt-2 text-lg text-muted">of the people most like you also chose “{card.myText}”.</p>
            <p className="mt-4 text-sm text-faint">That's what the computer used to guess you.</p>
          </div>
        )}
      </div>
      <p className="pt-4 text-sm text-faint">{copy.world}</p>
    </div>
  );
}

function GroupsCard({ card, view }: { card: Extract<MomentCard, { kind: "groups" }>; view: PlayerView }) {
  const points = (view.moment as any)?.points as { x: number; y: number; g: number }[] | undefined;
  return (
    <div>
      {points && (
        <div className="aspect-square w-full overflow-hidden rounded-2xl border border-line bg-surface">
          <DotMap points={points} highlight={card.index} />
        </div>
      )}
      <p className="mt-4 text-lg">
        <span className="font-display text-2xl font-bold">{card.similar}</span> <span className="text-muted">people answered at least 7 of 9 questions like you.</span>
      </p>
      {card.groupLabel && <p className="mt-2 text-sm text-muted">Your group — {card.groupLabel}</p>}
    </div>
  );
}

function FinaleIntro({ view }: { view: PlayerView }) {
  return view.me!.isFinalist ? (
    <Center kicker="THE FINALE" title="You made it." body="3 questions with right answers, plus a bonus speed question. Correct and fast wins." />
  ) : (
    <Center kicker="THE FINALE" title={`${view.finalistCount} finalists. One showdown.`} body="Play along on your phone — see if you'd have won." />
  );
}

function FinaleResults({ view }: { view: PlayerView }) {
  if (view.finaleScore) return <Center kicker="YOUR FINALE" title={`${view.finaleScore.correct} / ${view.finaleScore.of} correct`} body="Winners on the big screen in a moment…" />;
  return <Center kicker="FINALE" title="Scoring the finalists…" />;
}

function Winners({ view }: { view: PlayerView }) {
  const me = view.me!;
  if (me.isWinner)
    return (
      <div className="rise -mx-4 flex flex-1 flex-col justify-center bg-brand px-6 pb-[10vh]">
        <p className="text-sm font-bold tracking-[0.2em] text-white/80">DATA SURVIVOR</p>
        <h2 className="font-display mt-3 text-[64px] font-bold leading-none text-white">WINNER</h2>
        <p className="mt-4 text-xl text-white/90">Show this screen at the stage to collect your chocolate.</p>
        <p className="font-display mt-8 text-5xl font-bold tracking-[0.3em] text-white">{me.rejoinCode}</p>
        <p className="mt-2 text-sm text-white/70">Verification code</p>
      </div>
    );
  return <Center kicker="WINNERS" title="Congrats to the winners!" body="Your personal Wrapped is next." />;
}

createRoot(document.getElementById("root")!).render(<App />);
