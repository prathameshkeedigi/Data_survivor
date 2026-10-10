import { useEffect, useRef } from "react";
import { GROUP_HEX, NEUTRAL_DOT, OPTION_COLOR } from "../lib/live";

const KEYS = ["A", "B", "C", "D"] as const;

export function LetterChip({ k, size = "md" }: { k: string; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "h-12 w-12 text-2xl rounded-xl" : size === "sm" ? "h-6 w-6 text-xs rounded-md" : "h-9 w-9 text-lg rounded-lg";
  return (
    <span className={`${cls} font-display inline-flex shrink-0 items-center justify-center font-bold text-white`} style={{ background: OPTION_COLOR[k] }}>
      {k}
    </span>
  );
}

/** Horizontal bars, one per option. Bars grow from zero; labels sit in ink, not in the series colour. */
export function OptionBars({
  options,
  pct,
  highlight,
  delayMs = 0,
  big = false,
}: {
  options: { key: string; text: string }[];
  pct: Record<string, number>;
  highlight?: string | null;
  delayMs?: number;
  big?: boolean;
}) {
  return (
    <div className={big ? "space-y-[1.6vh]" : "space-y-[1.1vh]"}>
      {options.map((o, i) => {
        const dim = highlight && highlight !== o.key;
        return (
          <div key={o.key} className={dim ? "opacity-40" : ""}>
            <div className="flex items-center gap-[0.8vw]">
              <LetterChip k={o.key} size={big ? "md" : "sm"} />
              <div className="relative h-[2.2vh] min-h-3 flex-1 overflow-hidden rounded-[4px] bg-surface-2">
                <div
                  className="grow-x absolute inset-y-0 left-0 rounded-[4px]"
                  style={{ width: `${Math.max(pct[o.key] ?? 0, 0.6)}%`, background: OPTION_COLOR[o.key], animationDelay: `${delayMs + i * 90}ms` }}
                />
              </div>
              <span className={`tabular font-display w-[4.2em] text-right font-semibold ${big ? "text-[clamp(16px,2.2vw,40px)]" : "text-[clamp(13px,1.35vw,26px)]"}`}>
                {pct[o.key] ?? 0}%
              </span>
            </div>
            <p className={`mt-[0.4vh] truncate pl-[calc(1.5rem+0.8vw)] text-muted ${big ? "text-[clamp(13px,1.2vw,22px)]" : "text-[clamp(11px,0.95vw,18px)]"}`}>{o.text}</p>
          </div>
        );
      })}
    </div>
  );
}

/** Two columns of answers with ribbons between them; the strongest pattern is highlighted. */
export function RibbonChart({
  matrix,
  optA,
  optB,
  labelA,
  labelB,
}: {
  matrix: number[][];
  optA: string;
  optB: string;
  labelA: string;
  labelB: string;
}) {
  const W = 1000;
  const H = 520;
  const colW = 56;
  const gap = 14;
  const rows = matrix.map((r) => r.reduce((a, b) => a + b, 0));
  const cols = KEYS.map((_, j) => matrix.reduce((s, r) => s + r[j], 0));
  const total = Math.max(1, rows.reduce((a, b) => a + b, 0));
  const usable = H - 60 - gap * 3;
  const scale = usable / total;
  const leftY: number[] = [];
  const rightY: number[] = [];
  let y = 40;
  rows.forEach((r) => {
    leftY.push(y);
    y += r * scale + gap;
  });
  y = 40;
  cols.forEach((c) => {
    rightY.push(y);
    y += c * scale + gap;
  });
  const lOff = [...leftY];
  const rOff = [...rightY];
  const ribbons: { d: string; hot: boolean; i: number; j: number }[] = [];
  const x0 = 170 + colW;
  const x1 = W - 170 - colW;
  KEYS.forEach((a, i) =>
    KEYS.forEach((b, j) => {
      const v = matrix[i][j];
      if (!v) return;
      const h = v * scale;
      const ly = lOff[i];
      const ry = rOff[j];
      lOff[i] += h;
      rOff[j] += h;
      const mx = (x0 + x1) / 2;
      ribbons.push({
        d: `M${x0},${ly} C${mx},${ly} ${mx},${ry} ${x1},${ry} L${x1},${ry + h} C${mx},${ry + h} ${mx},${ly + h} ${x0},${ly + h} Z`,
        hot: a === optA && b === optB,
        i,
        j,
      });
    }),
  );
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label={`Ribbons between ${labelA} and ${labelB}`}>
      <text x={170} y={24} fill="var(--color-muted)" fontSize="20" textAnchor="start" fontFamily="var(--font-display)">
        {labelA}
      </text>
      <text x={W - 170} y={24} fill="var(--color-muted)" fontSize="20" textAnchor="end" fontFamily="var(--font-display)">
        {labelB}
      </text>
      {ribbons
        .sort((p, q) => Number(p.hot) - Number(q.hot))
        .map((r, k) => (
          <path
            key={k}
            d={r.d}
            fill={r.hot ? "var(--color-brand)" : "var(--color-line)"}
            opacity={r.hot ? 0.95 : 0.7}
            stroke="var(--color-bg)"
            strokeWidth={1.5}
            className="rise"
            style={{ animationDelay: `${r.hot ? 900 : 200 + k * 30}ms` }}
          />
        ))}
      {KEYS.map((k, i) =>
        rows[i] ? (
          <g key={`l${k}`}>
            <rect x={170} y={leftY[i]} width={colW} height={Math.max(rows[i] * scale, 3)} rx={4} fill={OPTION_COLOR[k]} />
            <text x={150} y={leftY[i] + (rows[i] * scale) / 2 + 9} fill="var(--color-ink)" fontSize="28" fontWeight="700" textAnchor="end" fontFamily="var(--font-display)">
              {k}
            </text>
          </g>
        ) : null,
      )}
      {KEYS.map((k, j) =>
        cols[j] ? (
          <g key={`r${k}`}>
            <rect x={W - 170 - colW} y={rightY[j]} width={colW} height={Math.max(cols[j] * scale, 3)} rx={4} fill={OPTION_COLOR[k]} />
            <text x={W - 150} y={rightY[j] + (cols[j] * scale) / 2 + 9} fill="var(--color-ink)" fontSize="28" fontWeight="700" fontFamily="var(--font-display)">
              {k}
            </text>
          </g>
        ) : null,
      )}
    </svg>
  );
}

/** The Map of the Room: one dot per person on a canvas (cheap to animate 500 dots on a weak laptop). */
export function DotMap({
  points,
  highlight,
  animate = true,
  dotScale = 1,
}: {
  points: { x: number; y: number; g: number }[];
  highlight?: number | null;
  animate?: boolean;
  dotScale?: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = wrap.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    let raf = 0;
    let start = 0;
    const draw = (t: number) => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
      }
      const ctx = cv.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!start) start = t;
      const p = animate ? Math.min(1, (t - start) / 1400) : 1;
      const ease = 1 - Math.pow(1 - p, 3);
      const r = Math.max(2.5, Math.min(w, h) / 90) * dotScale;
      points.forEach((pt, i) => {
        if (i === highlight) return;
        const x = w / 2 + (pt.x * w - w / 2) * ease;
        const y = h / 2 + (pt.y * h - h / 2) * ease;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = pt.g >= 0 ? GROUP_HEX[pt.g % GROUP_HEX.length] : NEUTRAL_DOT;
        ctx.globalAlpha = highlight != null ? 0.55 : 0.9;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#0e0d13";
        ctx.stroke();
      });
      if (highlight != null && points[highlight]) {
        const pt = points[highlight];
        const x = w / 2 + (pt.x * w - w / 2) * ease;
        const y = h / 2 + (pt.y * h - h / 2) * ease;
        ctx.beginPath();
        ctx.arc(x, y, r * 3.2, 0, Math.PI * 2);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, r * 1.6, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.font = `600 ${Math.max(12, r * 4)}px "Space Grotesk Variable", system-ui`;
        ctx.textAlign = x > w * 0.7 ? "right" : "left";
        ctx.fillText("You", x + (x > w * 0.7 ? -r * 4.2 : r * 4.2), y + r * 1.4);
      }
      if (p < 1) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      start = performance.now() - 5000;
      raf = requestAnimationFrame(draw);
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [points, highlight, animate, dotScale]);
  return (
    <div ref={wrap} className="relative h-full w-full">
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-label={`Map of ${points.length} people`} role="img" />
    </div>
  );
}

/** Lazy guess vs smart guess. */
export function PredictionBars({ lazy, smart }: { lazy: number; smart: number }) {
  const rows = [
    { label: "Lazy guess", sub: "always pick the most popular answer", v: lazy, color: "var(--color-faint)" },
    { label: "Smart guess", sub: "copy the 5 people who answered most like you", v: smart, color: "var(--color-brand)" },
  ];
  return (
    <div className="space-y-[4vh]">
      {rows.map((r, i) => (
        <div key={r.label}>
          <div className="mb-[1vh] flex items-baseline justify-between gap-4">
            <div>
              <p className="font-display text-[clamp(20px,2.6vw,48px)] font-semibold">{r.label}</p>
              <p className="text-[clamp(13px,1.2vw,22px)] text-muted">{r.sub}</p>
            </div>
            <p className="font-display tabular text-[clamp(32px,5vw,96px)] font-bold">{r.v}%</p>
          </div>
          <div className="h-[4vh] overflow-hidden rounded-[6px] bg-surface-2">
            <div className="grow-x h-full rounded-[6px]" style={{ width: `${Math.max(r.v, 1)}%`, background: r.color, animationDelay: `${300 + i * 700}ms` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
