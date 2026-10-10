// Phase 9 visuals: lobby dots, answer meter, survivors histogram, phone mini-bars and Wrapped charts.
import { useEffect, useRef } from "react";
import { OPTION_COLOR } from "../lib/live";

const KEYS = ["A", "B", "C", "D"] as const;

/** Lobby: one dot per person in the room. New dots pop in as people join. */
export function JoinDots({ count }: { count: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const shown = useRef(0);
  useEffect(() => {
    const el = wrap.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    const capacity = Math.max(100, Math.ceil(Math.max(count, 1) / 100) * 100);
    const from = Math.min(shown.current, count);
    const start = performance.now();
    let raf = 0;
    const draw = (t: number) => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      const ctx = cv.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const rows = Math.max(1, Math.round(Math.sqrt((capacity * h) / w)));
      const cols = Math.ceil(capacity / rows);
      const cell = Math.min(w / cols, h / rows);
      const r = cell * 0.32;
      const p = Math.min(1, (t - start) / 600);
      for (let i = 0; i < capacity; i++) {
        const x = (i % cols) * cell + cell / 2;
        const y = Math.floor(i / cols) * cell + cell / 2;
        const lit = i < count;
        const fresh = lit && i >= from;
        ctx.beginPath();
        ctx.arc(x, y, fresh ? r * (0.3 + 0.7 * p) : r, 0, Math.PI * 2);
        ctx.fillStyle = lit ? "#7b5ac6" : "#1e1b28";
        ctx.fill();
      }
      if (p < 1) raf = requestAnimationFrame(draw);
      else shown.current = count;
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [count]);
  return (
    <div ref={wrap} className="relative h-full w-full" data-testid="join-dots">
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" role="img" aria-label={`${count} people have joined`} />
    </div>
  );
}

/** Question: how much of the room has answered, as a ring. */
export function AnswerMeter({ answered, players }: { answered: number; players: number }) {
  const pct = players ? Math.min(100, Math.round((100 * answered) / players)) : 0;
  const R = 52;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative aspect-square h-full" data-testid="answer-meter" role="img" aria-label={`${answered} of ${players} answered`}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--color-surface-2)" strokeWidth="9" />
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * C} ${C}`}
          style={{ transition: "stroke-dasharray 500ms cubic-bezier(0.2,0.8,0.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display tabular text-[4.2vmin] font-bold leading-none">{pct}%</span>
        <span className="mt-[0.4vmin] text-[1.5vmin] text-muted">answered</span>
      </div>
    </div>
  );
}

/** Survivors: everyone's round score; survivors in brand colour, the rest muted, with the survival line. */
export function ScoreHistogram({ bins, kept }: { bins: number[]; kept: number[] }) {
  const W = 1000;
  const H = 420;
  const top = 40;
  const base = H - 60;
  const max = Math.max(1, ...bins);
  const bw = W / bins.length;
  const cutIdx = kept.findIndex((k) => k > 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" data-testid="survivors-chart" role="img" aria-label="Round scores, survivors highlighted">
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <line key={g} x1={0} x2={W} y1={base - (base - top) * g} y2={base - (base - top) * g} stroke="var(--color-line)" strokeWidth={1} />
      ))}
      {bins.map((n, i) => {
        const hAll = ((base - top) * n) / max;
        const hKept = ((base - top) * kept[i]) / max;
        const x = i * bw + 6;
        const w = bw - 12;
        return (
          <g key={i} className="grow-y" style={{ animationDelay: `${i * 70}ms` }}>
            {n - kept[i] > 0 && <rect x={x} y={base - hAll} width={w} height={hAll - hKept} rx={4} fill="var(--color-faint)" opacity={0.55} />}
            {kept[i] > 0 && <rect x={x} y={base - hKept} width={w} height={hKept} rx={4} fill="var(--color-brand)" />}
            {n > 0 && (
              <text x={x + w / 2} y={base - hAll - 10} textAnchor="middle" fill="var(--color-muted)" fontSize="22" fontFamily="var(--font-display)">
                {n}
              </text>
            )}
          </g>
        );
      })}
      <line x1={0} x2={W} y1={base} y2={base} stroke="var(--color-muted)" strokeWidth={2} />
      {cutIdx > 0 && (
        <g>
          <line x1={cutIdx * bw} x2={cutIdx * bw} y1={top - 18} y2={base} stroke="var(--color-ink)" strokeWidth={3} strokeDasharray="10 8" />
          <text x={cutIdx * bw + 12} y={top - 2} fill="var(--color-ink)" fontSize="22" fontWeight="700" fontFamily="var(--font-display)">
            survival line
          </text>
        </g>
      )}
      <text x={0} y={H - 16} fill="var(--color-muted)" fontSize="24" fontFamily="var(--font-display)">
        ← common answers
      </text>
      <text x={W} y={H - 16} fill="var(--color-muted)" fontSize="24" textAnchor="end" fontFamily="var(--font-display)">
        rare answers →
      </text>
    </svg>
  );
}

/** Phone results: the room's split on one question, your option highlighted. */
export function MiniBars({ dist, mine }: { dist: Record<string, number>; mine: string | null }) {
  return (
    <div className="space-y-1.5" data-testid="mini-bars">
      {KEYS.map((k, i) => (
        <div key={k} className={`flex items-center gap-2 ${mine && mine !== k ? "opacity-45" : ""}`}>
          <span className="w-3 text-[11px] font-bold text-muted">{k}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-[3px] bg-surface-2">
            <div className="grow-x h-full rounded-[3px]" style={{ width: `${Math.max(dist[k] ?? 0, 1)}%`, background: OPTION_COLOR[k], animationDelay: `${i * 80}ms` }} />
          </div>
          <span className={`tabular w-9 text-right text-xs ${mine === k ? "font-bold text-ink" : "text-muted"}`}>{dist[k] ?? 0}%</span>
        </div>
      ))}
    </div>
  );
}

/** Wrapped: 12 questions — with the crowd, against it, or skipped. Ink-only so it works on any card colour. */
export function TimelineStrip({ items, ink }: { items: { num: number; mark: "with" | "against" | "skip" }[]; ink: string }) {
  return (
    <div data-testid="wrapped-timeline">
      <div className="grid grid-cols-12 gap-1.5">
        {items.map((t, i) => (
          <div key={t.num} className="pop flex flex-col items-center gap-1" style={{ animationDelay: `${200 + i * 70}ms` }}>
            <div
              className="aspect-[1/2.2] w-full rounded-[4px]"
              style={{
                background: t.mark === "against" ? ink : t.mark === "with" ? `${ink}40` : "transparent",
                border: t.mark === "skip" ? `1.5px dashed ${ink}80` : "none",
              }}
            />
            <span className="tabular text-[10px] opacity-75">{t.num}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-85">
        <Legend swatch={{ background: ink }} label="against the crowd" />
        <Legend swatch={{ background: `${ink}40` }} label="with the crowd" />
        <Legend swatch={{ border: `1.5px dashed ${ink}80` }} label="skipped" />
      </div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: React.CSSProperties; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <i className="inline-block h-3 w-2 rounded-[2px]" style={swatch} /> {label}
    </span>
  );
}

/** Wrapped: per round, how common your answers were vs the room's average (lower = rarer). */
export function RoundsBars({ rounds, ink }: { rounds: { round: number; me: number | null; room: number }[]; ink: string }) {
  const max = Math.max(1, ...rounds.flatMap((r) => [r.me ?? 0, r.room]));
  return (
    <div data-testid="wrapped-rounds">
      <div className="flex h-44 items-end gap-4">
        {rounds.map((r, i) => (
          <div key={r.round} className="flex h-full flex-1 flex-col justify-end">
            <div className="flex flex-1 items-end justify-center gap-1.5">
              {[
                { v: r.me, c: ink },
                { v: r.room, c: `${ink}45` },
              ].map((b, k) => (
                <div key={k} className="flex h-full w-1/2 max-w-7 flex-col justify-end">
                  <span className="tabular mb-1 text-center text-[11px] font-semibold">{b.v === null ? "–" : `${b.v}%`}</span>
                  <div
                    className="grow-y rounded-t-[4px]"
                    style={{ height: `${((b.v ?? 0) / max) * 100}%`, minHeight: b.v === null ? 0 : 3, background: b.c, animationDelay: `${i * 150 + k * 80}ms` }}
                  />
                </div>
              ))}
            </div>
            <span className="mt-2 text-center text-xs opacity-80">R{r.round}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-4 text-xs opacity-85">
        <Legend swatch={{ background: ink }} label="you" />
        <Legend swatch={{ background: `${ink}45` }} label="room average" />
      </div>
    </div>
  );
}

const TAG_NAMES: Record<string, string> = { evidence: "Evidence", experiment: "Experiment", independent: "Independent", systems: "Systems", strategic: "Strategy" };

/** Wrapped: which playful tags your answers carried. */
export function TagBars({ tags, top, ink }: { tags: Record<string, number>; top: string | null; ink: string }) {
  const max = Math.max(1, ...Object.values(tags));
  const sorted = Object.entries(tags).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-2" data-testid="wrapped-tags">
      {sorted.map(([t, n], i) => {
        const hot = t === top || (!top && i === 0);
        return (
          <div key={t} className="flex items-center gap-3">
            <span className={`w-24 text-sm ${hot ? "font-bold" : "opacity-80"}`}>{TAG_NAMES[t] ?? t}</span>
            <div className="h-3 flex-1 overflow-hidden rounded-[3px]" style={{ background: `${ink}1f` }}>
              <div className="grow-x h-full rounded-[3px]" style={{ width: `${(n / max) * 100}%`, background: hot ? ink : `${ink}66`, animationDelay: `${i * 90}ms` }} />
            </div>
            <span className="tabular w-5 text-right text-sm">{n}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Wrapped: the room's split on your rarest question, your option highlighted. */
export function DistBars({ dist, mine, ink }: { dist: Record<string, number>; mine: string; ink: string }) {
  const max = Math.max(1, ...Object.values(dist));
  return (
    <div className="flex h-36 items-end gap-3" data-testid="wrapped-dist">
      {KEYS.map((k, i) => (
        <div key={k} className="flex h-full flex-1 flex-col justify-end">
          <span className={`tabular mb-1 text-center text-sm ${k === mine ? "font-bold" : "opacity-70"}`}>{dist[k] ?? 0}%</span>
          <div
            className="grow-y rounded-t-[5px]"
            style={{ height: `${((dist[k] ?? 0) / max) * 100}%`, minHeight: 3, background: k === mine ? OPTION_COLOR[k] : `${ink}2e`, animationDelay: `${i * 100}ms` }}
          />
          <span className={`mt-2 text-center text-sm ${k === mine ? "font-bold" : "opacity-70"}`}>{k === mine ? `${k} · you` : k}</span>
        </div>
      ))}
    </div>
  );
}
