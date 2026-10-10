import { createRoot } from "react-dom/client";
import { useCallback, useEffect, useRef, useState } from "react";
import "./styles.css";
import type { CountUpdate, HostView } from "../../shared/views";
import type { Scene } from "../../shared/types";
import { call, makeSocket, qNumber, storage, useConnected, useCountdown } from "./lib/live";

const socket = makeSocket();
const KEY = "ds_host_key";
const BACKUP = "ds_host_backup";

function sceneName(s: Scene | null): string {
  if (!s) return "End";
  switch (s.type) {
    case "lobby":
      return "Lobby (QR code)";
    case "question":
      return s.round === 5 ? `Finale ${qNumber(s.qid)}` : `${qNumber(s.qid)} · Round ${s.round}`;
    case "results":
      return `Results · Round ${s.round}`;
    case "survivors":
      return `Survivors · Round ${s.round}`;
    case "moment":
      return `Data moment ${s.round}`;
    case "finale_intro":
      return "Finale intro";
    case "finale_results":
      return "Finale results (lock winners)";
    case "winners":
      return "Winners reveal";
    case "recap":
      return "Room Decoded recap";
    case "wrapped":
      return "Wrapped (phones)";
  }
}

const ERRORS: Record<string, string> = {
  TOO_FAST: "Pressed too fast — try again.",
  LOCK_REQUIRED: "Lock the survivors / winners first.",
  AT_END: "That's the end of the show.",
  AT_START: "Already at the start.",
  WRONG_SCENE: "Not available on this scene.",
  INVALID_CUTOFF: "Pick a number between 1 and the limit.",
  TIMEOUT: "No reply from the server — check the connection.",
  FORBIDDEN: "Not logged in as host.",
};

interface Confirm {
  title: string;
  body: string;
  label: string;
  requireText?: string;
  run: () => void;
}

function App() {
  const [authed, setAuthed] = useState(false);
  const [view, setView] = useState<HostView | null>(null);
  const [stamp, setStamp] = useState(0);
  const [count, setCount] = useState<CountUpdate>({ players: 0, answered: 0 });
  const [backupAt, setBackupAt] = useState<number | null>(() => {
    const b = storage.get(BACKUP);
    return b ? JSON.parse(b).at : null;
  });
  const [toast, setToast] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const connected = useConnected(socket);

  useEffect(() => {
    const onState = (v: HostView) => {
      setView(v);
      setStamp((s) => s + 1);
      setCount({ players: v.playerCount, answered: v.answered });
    };
    const onCount = (c: CountUpdate) => setCount(c);
    const onBackup = (b: { at: number }) => {
      storage.set(BACKUP, JSON.stringify(b));
      setBackupAt(b.at);
    };
    const onConnect = async () => {
      const hostKey = sessionStorage.getItem(KEY);
      if (hostKey) {
        const r = await call(socket, "host:login", { hostKey });
        setAuthed(!!r.ok);
      }
    };
    socket.on("state", onState);
    socket.on("count", onCount);
    socket.on("host:backup", onBackup);
    socket.on("connect", onConnect);
    if (socket.connected) onConnect();
    return () => {
      socket.off("state", onState);
      socket.off("count", onCount);
      socket.off("host:backup", onBackup);
      socket.off("connect", onConnect);
    };
  }, []);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2500);
  }, []);

  const act = useCallback(
    async (action: Record<string, unknown>) => {
      const r = await call(socket, "host:action", action);
      if (!r.ok) flash(ERRORS[r.error] ?? r.error);
      return r;
    },
    [flash],
  );

  // Keyboard: Space next, ← back, P pause, F fallback.
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (confirm || t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
      const v = viewRef.current;
      if (!v) return;
      if (e.code === "Space") {
        e.preventDefault();
        act({ type: "advance" });
      } else if (e.code === "ArrowLeft") act({ type: "back" });
      else if (e.key.toLowerCase() === "p" && v.votingOpen) act({ type: v.paused ? "resume" : "pause" });
      else if (e.key.toLowerCase() === "f" && v.scene.type === "moment") act({ type: "setFallback", on: !v.fallback });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [act, confirm]);

  if (!authed || !view) return <Login onAuthed={() => setAuthed(true)} />;

  const sc = view.scene;
  const h = view.host;
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-4" data-scene={sc.type}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-good" : "bg-critical"}`} title={connected ? "Connected" : "Disconnected"} />
          <span className="font-display text-lg font-bold tracking-[0.12em]">
            DATA<span className="text-brand-ink">SURVIVOR</span> <span className="text-sm font-medium tracking-normal text-muted">host</span>
          </span>
        </div>
        <div className="tabular flex gap-4 text-sm text-muted">
          <span>
            <b className="text-ink">{count.players}</b> joined
          </span>
          <span>
            <b className="text-ink">{h.activeCount}</b> active
          </span>
          <span>
            <b className="text-ink">{h.analystCount}</b> analysts
          </span>
        </div>
      </header>

      {view.rehearsal && (
        <p className="mt-3 rounded-lg bg-brand/15 px-3 py-2 text-sm text-brand-ink">Rehearsal mode — the projector shows a SIMULATED DATA badge. Turn it off below before the real game.</p>
      )}

      <section className="mt-4 grid gap-4 md:grid-cols-[1.3fr_1fr]">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-xs font-semibold tracking-[0.14em] text-muted">
            NOW · {h.sceneIndex + 1}/{h.sceneCount}
          </p>
          <h1 className="font-display mt-1 text-3xl font-bold">{sceneName(sc)}</h1>
          <p className="mt-1 text-sm text-muted">Next: {sceneName(h.nextScene)}</p>

          {sc.type === "question" && <QuestionPanel view={view} stamp={stamp} answered={count.answered} players={count.players} />}
          {sc.type === "results" && <SurvivorPanel view={view} act={act} ask={setConfirm} />}
          {sc.type === "finale_results" && <WinnersPanel view={view} act={act} ask={setConfirm} />}
          {sc.type === "moment" && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className={`rounded-full px-3 py-1 text-sm ${h.momentStatus === "ready" ? "bg-good/20 text-[#7fe07f]" : h.momentStatus === "failed" ? "bg-critical/25 text-[#ff9a9a]" : "bg-surface-2 text-muted"}`}>
                Chart: {h.momentStatus === "ready" ? "ready (live data)" : h.momentStatus === "failed" ? "FAILED — press F for the fallback" : "calculating…"}
              </span>
              <button onClick={() => act({ type: "setFallback", on: !view.fallback })} className="h-10 rounded-xl border border-line px-4 text-sm font-semibold">
                {view.fallback ? "Back to live chart (F)" : "Show fallback chart (F)"}
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <button
            data-testid="host-next"
            onClick={() => act({ type: "advance" })}
            className="font-display h-24 rounded-2xl bg-brand text-2xl font-bold text-white transition active:scale-[0.98]"
          >
            {view.votingOpen ? "Close voting" : "Next"} <span className="text-base font-medium opacity-70">Space</span>
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => act({ type: "back" })} className="h-14 rounded-2xl border border-line bg-surface font-semibold">
              ← Back
            </button>
            <button
              disabled={!view.votingOpen}
              onClick={() => act({ type: view.paused ? "resume" : "pause" })}
              className="h-14 rounded-2xl border border-line bg-surface font-semibold disabled:opacity-30"
            >
              {view.paused ? "Resume (P)" : "Pause (P)"}
            </button>
          </div>
        </div>
      </section>

      <Settings view={view} act={act} ask={setConfirm} backupAt={backupAt} flash={flash} />

      {toast && (
        <div className="fixed inset-x-0 bottom-6 mx-auto w-fit rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-bg shadow-lg" role="status">
          {toast}
        </div>
      )}
      {confirm && <ConfirmDialog c={confirm} close={() => setConfirm(null)} />}
    </div>
  );
}

function Login({ onAuthed }: { onAuthed: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await call(socket, "host:login", { password: pw });
    if (r.ok) {
      sessionStorage.setItem(KEY, r.hostKey);
      onAuthed();
    } else setErr(r.error === "BAD_PASSWORD" ? "Wrong password." : "Couldn't log in. Check the connection.");
  };
  return (
    <form onSubmit={submit} className="mx-auto mt-[20vh] max-w-sm space-y-3 px-4">
      <h1 className="font-display text-3xl font-bold">
        Host <span className="text-brand-ink">login</span>
      </h1>
      <input
        data-testid="host-password"
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        className="h-12 w-full rounded-xl border border-line bg-surface px-3 outline-none focus:border-brand"
        placeholder="Host password"
        autoFocus
      />
      {err && <p className="text-sm text-[#ff8f8f]">{err}</p>}
      <button data-testid="host-login" className="font-display h-12 w-full rounded-xl bg-brand font-bold text-white">
        Log in
      </button>
    </form>
  );
}

function QuestionPanel({ view, stamp, answered, players }: { view: HostView; stamp: number; answered: number; players: number }) {
  const left = useCountdown(view.msRemaining, view.votingOpen && !view.paused, stamp);
  return (
    <div className="mt-4">
      <p className="text-sm text-muted line-clamp-2">{view.question?.prompt}</p>
      <div className="mt-3 flex items-end gap-6">
        <div>
          <p className="font-display tabular text-5xl font-bold">
            {answered}
            <span className="text-2xl text-muted">/{players}</span>
          </p>
          <p className="text-sm text-muted">answered</p>
        </div>
        {view.votingOpen ? (
          <div data-testid="voting-open">
            <p className="font-display tabular text-5xl font-bold">{view.paused ? "II" : Math.ceil(left / 1000)}s</p>
            <p className="text-sm text-muted">{view.paused ? "paused" : "voting open"}</p>
          </div>
        ) : (
          <p className="pb-2 text-sm font-semibold text-muted">Voting closed</p>
        )}
      </div>
    </div>
  );
}

function SurvivorPanel({ view, act, ask }: { view: HostView; act: (a: Record<string, unknown>) => Promise<any>; ask: (c: Confirm) => void }) {
  const h = view.host;
  const [keep, setKeep] = useState(h.suggestedKeep);
  const [tied, setTied] = useState(h.tiedAtCutoff);
  useEffect(() => setKeep(h.suggestedKeep), [h.suggestedKeep]);
  useEffect(() => {
    if (keep >= 1) act({ type: "previewCutoff", keep }).then((r) => r.ok && setTied(r.tiedAtCutoff));
  }, [keep, act]);
  const round = view.scene.type === "results" ? view.scene.round : 0;
  return (
    <div className="mt-4 rounded-xl bg-surface-2 p-4">
      <p className="text-sm font-semibold">{round === 4 ? "How many finalists?" : `How many survive round ${round}?`}</p>
      <div className="mt-2 flex items-center gap-2">
        <button onClick={() => setKeep((k) => Math.max(1, k - 1))} className="h-11 w-11 rounded-lg border border-line text-xl">
          −
        </button>
        <input
          type="number"
          value={keep}
          min={1}
          max={h.activeCount || 1}
          onChange={(e) => setKeep(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
          className="font-display tabular h-11 w-24 rounded-lg border border-line bg-bg text-center text-xl font-bold"
        />
        <button onClick={() => setKeep((k) => Math.min(h.activeCount || 1, k + 1))} className="h-11 w-11 rounded-lg border border-line text-xl">
          +
        </button>
        <span className="text-sm text-muted">
          of {h.activeCount} active · suggested {h.suggestedKeep}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted">{tied > 1 ? `${tied} players share the cutoff score — ties are broken by answer speed.` : "No tie at the cutoff."}</p>
      <div className="mt-3 flex items-center gap-3">
        <button
          data-testid="lock-survivors"
          onClick={() =>
            ask({
              title: `Lock ${keep} survivors?`,
              body: `${Math.max(0, h.activeCount - keep)} players move to Analyst Mode. You can re-lock while still on this screen.`,
              label: "Lock survivors",
              run: () => act({ type: "lockSurvivors", keep }),
            })
          }
          className="h-11 rounded-xl bg-ink px-4 font-semibold text-bg"
        >
          {h.locked ? "Re-lock" : "Lock survivors"}
        </button>
        {h.locked && (
          <span data-testid="locked-badge" className="text-sm font-semibold text-[#7fe07f]">
            ✓ Locked — press Next
          </span>
        )}
      </div>
    </div>
  );
}

function WinnersPanel({ view, act, ask }: { view: HostView; act: (a: Record<string, unknown>) => Promise<any>; ask: (c: Confirm) => void }) {
  const h = view.host;
  const [count, setCount] = useState(Math.max(1, Math.min(10, h.finalists)));
  const [hidden, setHidden] = useState<string[]>([]);
  const preview = h.winnersPreview.slice(0, count);
  return (
    <div className="mt-4 rounded-xl bg-surface-2 p-4">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold">Winners</p>
        <input
          type="number"
          min={1}
          max={20}
          value={count}
          onChange={(e) => setCount(Math.max(1, Math.min(20, Math.floor(Number(e.target.value) || 1))))}
          className="font-display tabular h-9 w-16 rounded-lg border border-line bg-bg text-center font-bold"
        />
        <span className="text-xs text-muted">max 20 · {h.finalists} finalists</span>
      </div>
      <ol className="mt-3 max-h-64 space-y-1 overflow-auto text-sm">
        {preview.map((w, i) => (
          <li key={w.playerId} className="flex items-center justify-between gap-2 rounded-lg bg-bg px-3 py-1.5">
            <span>
              <b className="tabular">#{i + 1}</b> {hidden.includes(w.playerId) ? <s className="text-muted">{w.nickname}</s> : w.nickname}
              <span className="ml-2 text-muted">
                {w.correct}/3 · {(w.timeOnCorrectMs / 1000).toFixed(1)}s
              </span>
            </span>
            <button
              onClick={() => setHidden((x) => (x.includes(w.playerId) ? x.filter((y) => y !== w.playerId) : [...x, w.playerId]))}
              className="text-xs text-muted underline"
            >
              {hidden.includes(w.playerId) ? "show name" : "hide name"}
            </button>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex items-center gap-3">
        <button
          data-testid="lock-winners"
          onClick={() =>
            ask({
              title: `Lock ${Math.min(count, h.finalists)} winners?`,
              body: hidden.length ? `${hidden.length} name(s) will be hidden on the projector.` : "Names will appear on the projector at the reveal.",
              label: "Lock winners",
              run: () => act({ type: "lockWinners", count, hide: hidden }),
            })
          }
          className="h-11 rounded-xl bg-ink px-4 font-semibold text-bg"
        >
          {h.winnersLocked ? "Re-lock winners" : "Lock winners"}
        </button>
        {h.winnersLocked && (
          <span data-testid="winners-locked-badge" className="text-sm font-semibold text-[#7fe07f]">
            ✓ Locked — press Next to reveal
          </span>
        )}
      </div>
    </div>
  );
}

function Settings({
  view,
  act,
  ask,
  backupAt,
  flash,
}: {
  view: HostView;
  act: (a: Record<string, unknown>) => Promise<any>;
  ask: (c: Confirm) => void;
  backupAt: number | null;
  flash: (m: string) => void;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const age = backupAt ? Math.round((Date.now() - backupAt) / 1000) : null;
  const fileRef = useRef<HTMLInputElement>(null);

  const restore = (backup: unknown) =>
    ask({
      title: "Restore the game from backup?",
      body: "Use this only if the server restarted and lost the game. Phones will reconnect automatically.",
      label: "Restore",
      run: async () => {
        const r = await act({ type: "restore", backup });
        if (r.ok) flash("Restored.");
      },
    });

  return (
    <section className="mt-4 grid gap-3 rounded-2xl border border-line p-4 text-sm md:grid-cols-3">
      <div className="space-y-2">
        <p className="font-semibold">Room</p>
        <Toggle on={view.host.joinsLocked} label="Lock joining" onChange={(on) => act({ type: on ? "lockJoins" : "unlockJoins" })} />
        <Toggle on={view.rehearsal} label="Rehearsal badge on projector" onChange={(on) => act({ type: "setRehearsal", on })} />
      </div>
      <div className="space-y-2">
        <p className="font-semibold">Backup</p>
        <p className="text-muted">{age === null ? "No backup yet" : `Last backup ${age}s ago (in this browser)`}</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              const b = storage.get(BACKUP);
              if (b) restore(JSON.parse(b));
              else flash("No backup in this browser.");
            }}
            className="h-9 rounded-lg border border-line px-3"
          >
            Restore
          </button>
          <button
            onClick={() => {
              const b = storage.get(BACKUP);
              if (!b) return flash("No backup yet.");
              const a = document.createElement("a");
              a.href = URL.createObjectURL(new Blob([b], { type: "application/json" }));
              a.download = `data-survivor-backup-${new Date().toISOString().slice(11, 19).replace(/:/g, "")}.json`;
              a.click();
            }}
            className="h-9 rounded-lg border border-line px-3"
          >
            Download
          </button>
          <button onClick={() => fileRef.current?.click()} className="h-9 rounded-lg border border-line px-3">
            Upload…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) restore(JSON.parse(await f.text()));
              e.target.value = "";
            }}
          />
        </div>
      </div>
      <div className="space-y-2">
        <p className="font-semibold">Danger zone</p>
        <button
          data-testid="host-reset"
          onClick={() =>
            ask({
              title: "Reset the whole game?",
              body: "Everyone is removed and the game returns to the lobby. Do this once before the audience arrives.",
              label: "Reset",
              requireText: "RESET",
              run: () => act({ type: "reset", confirm: "RESET" }),
            })
          }
          className="h-9 rounded-lg border border-critical/60 px-3 text-[#ff9a9a]"
        >
          Reset game…
        </button>
        <p className="text-xs text-faint">Keys: Space next · ← back · P pause · F fallback chart</p>
      </div>
    </section>
  );
}

function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: (on: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-[#7b5ac6]" />
      {label}
    </label>
  );
}

function ConfirmDialog({ c, close }: { c: Confirm; close: () => void }) {
  const [text, setText] = useState("");
  const ok = !c.requireText || text === c.requireText;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display text-xl font-bold">{c.title}</h2>
        <p className="mt-2 text-sm text-muted">{c.body}</p>
        {c.requireText && (
          <input
            data-testid="reset-confirm-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Type ${c.requireText}`}
            className="mt-3 h-11 w-full rounded-lg border border-line bg-bg px-3"
            autoFocus
          />
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={close} className="h-11 rounded-xl border border-line px-4">
            Cancel
          </button>
          <button
            data-testid="confirm-yes"
            disabled={!ok}
            onClick={() => {
              c.run();
              close();
            }}
            className="h-11 rounded-xl bg-brand px-4 font-semibold text-white disabled:opacity-40"
            autoFocus={!c.requireText}
          >
            {c.label}
          </button>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
