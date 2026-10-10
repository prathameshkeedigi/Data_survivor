import { useEffect, useMemo, useRef, useState } from "react";
import type { WrappedData } from "../../../shared/moments";
import { DotMap } from "../components/charts";
import { DistBars, RoundsBars, TagBars, TimelineStrip } from "../components/visuals";

type Card = { key: string; bg: string; ink: string; body: React.ReactNode };

const STATUS_LINE: Record<WrappedData["status"], string> = {
  winner: "You won the whole thing.",
  finalist: "You made the finale.",
  survivor: "You survived the rarity rounds.",
  analyst: "You played as an Analyst — and built the charts.",
};

export function Wrapped({ data }: { data: WrappedData }) {
  const [i, setI] = useState(0);
  const cards = useMemo<Card[]>(() => {
    const list: Card[] = [
      {
        key: "intro",
        bg: "#7b5ac6",
        ink: "#ffffff",
        body: (
          <>
            <p className="text-sm font-bold tracking-[0.2em] opacity-80">YOUR DATA SURVIVOR WRAPPED</p>
            <h2 className="font-display mt-6 break-words text-[54px] font-bold leading-[0.95]">{data.nickname}</h2>
            <p className="mt-6 text-2xl leading-snug">
              You answered <b>{data.answered}</b> questions. {data.n} people played.
            </p>
            <p className="mt-4 text-xl opacity-90">{STATUS_LINE[data.status]}</p>
          </>
        ),
      },
    ];
    if (data.rarest)
      list.push({
        key: "rarest",
        bg: "#0e0d13",
        ink: "#f4f2f8",
        body: (
          <>
            <p className="text-sm font-bold tracking-[0.2em] text-[#b9a3f7]">YOUR RAREST CHOICE</p>
            <p className="font-display mt-6 text-[96px] font-bold leading-none">{data.rarest.pct}%</p>
            <p className="mt-3 text-xl text-[#a7a2b8]">
              of the room ({data.rarest.count} {data.rarest.count === 1 ? "person" : "people"}) chose what you did on Q{data.rarest.num}:
            </p>
            <p className="font-display mt-6 text-2xl font-semibold leading-snug">“{data.rarest.text}”</p>
            <div className="mt-8">
              <p className="mb-3 text-sm text-[#a7a2b8]">How the room split on Q{data.rarest.num}</p>
              <DistBars dist={data.rarest.dist} mine={data.rarest.option} ink="#f4f2f8" />
            </div>
          </>
        ),
      });
    list.push({
      key: "room",
      bg: "#2b6cc4",
      ink: "#ffffff",
      body: (
        <>
          <p className="text-sm font-bold tracking-[0.2em] opacity-80">YOU VS THE ROOM</p>
          <p className="font-display mt-6 text-[96px] font-bold leading-none">
            {data.againstMajority.count}
            <span className="text-5xl opacity-70">/{data.againstMajority.of}</span>
          </p>
          <p className="mt-4 text-2xl leading-snug">times you went against the most popular answer.</p>
          <p className="mt-6 text-lg opacity-85">
            {data.againstMajority.of === 0
              ? "You watched more than you played — that's data too."
              : data.againstMajority.count / data.againstMajority.of > 0.5
                ? "Mostly against the crowd."
                : "Mostly with the crowd — on your own terms."}
          </p>
          {data.timeline.length > 0 && (
            <div className="mt-8">
              <p className="mb-3 text-sm opacity-85">Question by question</p>
              <TimelineStrip items={data.timeline} ink="#ffffff" />
            </div>
          )}
        </>
      ),
    });
    if (data.rounds.length > 0)
      list.push({
        key: "rounds",
        bg: "#4b3482",
        ink: "#ffffff",
        body: (
          <>
            <p className="text-sm font-bold tracking-[0.2em] opacity-80">ROUND BY ROUND</p>
            <h2 className="font-display mt-6 text-[40px] font-bold leading-[1.05]">How common were your answers?</h2>
            <p className="mt-3 text-lg opacity-85">Average share of the room that picked the same as you. Lower means rarer.</p>
            <div className="mt-8">
              <RoundsBars rounds={data.rounds} ink="#ffffff" />
            </div>
          </>
        ),
      });
    if (data.map)
      list.push({
        key: "map",
        bg: "#17151f",
        ink: "#f4f2f8",
        body: (
          <>
            <p className="text-sm font-bold tracking-[0.2em] text-[#b9a3f7]">YOUR PLACE ON THE MAP</p>
            <div className="mt-4 aspect-square w-full overflow-hidden rounded-2xl border border-[#2d2939]">
              <DotMap points={data.map.points} highlight={data.map.myIndex} />
            </div>
            <p className="mt-4 text-lg text-[#a7a2b8]">Each dot is a person. People who answered alike sit close together.</p>
            {data.map.groupLabel && <p className="mt-2 text-base">Your group — {data.map.groupLabel}</p>}
          </>
        ),
      });
    list.push({
      key: "label",
      bg: "#11805a",
      ink: "#ffffff",
      body: (
        <>
          <p className="text-sm font-bold tracking-[0.2em] opacity-80">YOUR THINKING STYLE</p>
          <h2 className="font-display mt-6 text-[52px] font-bold leading-[0.95]">{data.label.name}</h2>
          {data.label.evidence.length > 0 && (
            <div className="mt-6 space-y-2">
              <p className="text-base opacity-85">{data.label.tag ? "Because you chose:" : "A few of your picks:"}</p>
              {data.label.evidence.map((e) => (
                <p key={e.num} className="rounded-xl bg-black/15 px-3 py-2 text-base leading-snug">
                  Q{e.num}: “{e.text}”
                </p>
              ))}
            </div>
          )}
          {Object.keys(data.tags).length > 0 && (
            <div className="mt-6">
              <TagBars tags={data.tags} top={data.label.tag} ink="#ffffff" />
            </div>
          )}
          <p className="mt-6 text-sm opacity-75">A playful label from your answers — not a personality test.</p>
        </>
      ),
    });
    list.push({ key: "share", bg: "#0e0d13", ink: "#f4f2f8", body: <ShareCard data={data} /> });
    return list;
  }, [data]);

  const card = cards[Math.min(i, cards.length - 1)];
  const last = i >= cards.length - 1;
  const go = (d: number) => setI((x) => Math.max(0, Math.min(cards.length - 1, x + d)));

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: card.bg, color: card.ink }} data-testid="wrapped-card">
      <div className="flex gap-1 px-4 pt-[max(12px,env(safe-area-inset-top))]">
        {cards.map((c, k) => (
          <div key={c.key} className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.25)" }}>
            <div className="h-full rounded-full transition-all duration-300" style={{ width: k <= i ? "100%" : "0%", background: card.ink }} />
          </div>
        ))}
      </div>
      <div className="relative mx-auto flex w-full max-w-[520px] flex-1 flex-col overflow-y-auto px-6 pb-4 pt-8">
        {card.key !== "share" && (
          <>
            <button aria-label="Previous" className="absolute inset-y-0 left-0 z-10 w-1/4" onClick={() => go(-1)} />
            <button aria-label="Next" className="absolute inset-y-0 right-0 z-10 w-3/4" onClick={() => go(1)} />
          </>
        )}
        <div key={card.key} className="rise relative">
          {card.body}
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-[520px] gap-3 px-6 pb-[max(16px,env(safe-area-inset-bottom))]">
        <button onClick={() => go(-1)} disabled={i === 0} className="h-12 rounded-full px-5 text-sm font-semibold disabled:opacity-30" style={{ border: `1px solid ${card.ink}55` }}>
          Back
        </button>
        {!last && (
          <button data-testid="wrapped-next" onClick={() => go(1)} className="h-12 flex-1 rounded-full text-sm font-bold" style={{ background: card.ink, color: card.bg }}>
            Next
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------- Share image (drawn directly with Canvas — reliable fonts on iPhone) ----------------

function ShareCard({ data }: { data: WrappedData }) {
  const [withName, setWithName] = useState(true);
  const [url, setUrl] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);

  useEffect(() => {
    let cancelled = false;
    drawShare(data, withName).then((blob) => {
      if (cancelled || !blob) return;
      blobRef.current = blob;
      setUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [data, withName]);

  const file = () => new File([blobRef.current!], "data-survivor-wrapped.png", { type: "image/png" });
  const canShare = typeof navigator !== "undefined" && !!navigator.canShare && !!blobRef.current && navigator.canShare({ files: [file()] });

  const share = async () => {
    if (!blobRef.current) return;
    try {
      if (canShare) await navigator.share({ files: [file()], title: "My DATA SURVIVOR Wrapped" });
      else {
        const a = document.createElement("a");
        a.href = url!;
        a.download = "data-survivor-wrapped.png";
        a.click();
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div data-testid="share-card">
      <p className="text-sm font-bold tracking-[0.2em] text-[#b9a3f7]">SHARE YOUR WRAPPED</p>
      <div className="mx-auto mt-4 aspect-[9/16] w-[58%] overflow-hidden rounded-2xl border border-[#2d2939] bg-[#17151f]">
        {url ? <img src={url} alt="Your Wrapped share card" className="h-full w-full object-cover" /> : null}
      </div>
      <label className="mt-4 flex items-center justify-center gap-2 text-sm">
        <input type="checkbox" checked={withName} onChange={(e) => setWithName(e.target.checked)} className="h-5 w-5 accent-[#7b5ac6]" />
        Show my nickname
      </label>
      <button onClick={share} disabled={!url} className="font-display mt-4 h-14 w-full rounded-2xl bg-[#7b5ac6] text-lg font-bold text-white disabled:opacity-40">
        {canShare ? "Share" : "Save image"}
      </button>
      <p className="mt-2 text-center text-xs text-[#a7a2b8]">If nothing happens, long-press the image to save it.</p>
    </div>
  );
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

async function drawShare(data: WrappedData, withName: boolean): Promise<Blob | null> {
  const W = 1080;
  const H = 1920;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;
  const font = '"Space Grotesk Variable", system-ui, sans-serif';
  try {
    await document.fonts.load(`700 80px ${font}`);
  } catch {
    /* system font fallback */
  }

  ctx.fillStyle = "#0e0d13";
  ctx.fillRect(0, 0, W, H);
  // Bold purple block
  ctx.fillStyle = "#7b5ac6";
  ctx.beginPath();
  ctx.roundRect(60, 60, W - 120, 880, 48);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = `700 40px ${font}`;
  ctx.fillText("DATA SURVIVOR · WRAPPED", 120, 160);

  let y = 330;
  if (withName) {
    ctx.font = `700 110px ${font}`;
    for (const l of wrapText(ctx, data.nickname, W - 240).slice(0, 2)) {
      ctx.fillText(l, 120, y);
      y += 115;
    }
    y += 30;
  }
  ctx.font = `500 52px ${font}`;
  ctx.fillText(withName ? "is a" : "I'm a", 120, y);
  y += 120;
  ctx.font = `700 104px ${font}`;
  for (const l of wrapText(ctx, data.label.name, W - 240).slice(0, 3)) {
    ctx.fillText(l, 120, y);
    y += 110;
  }

  // Stat
  ctx.fillStyle = "#f4f2f8";
  if (data.rarest) {
    ctx.font = `700 220px ${font}`;
    ctx.fillText(`${data.rarest.pct}%`, 100, 1210);
    ctx.font = `500 46px ${font}`;
    ctx.fillStyle = "#a7a2b8";
    const lines = wrapText(ctx, `of the room made my rarest choice on Q${data.rarest.num}: “${data.rarest.text}”`, W - 220);
    lines.slice(0, 4).forEach((l, k) => ctx.fillText(l, 110, 1300 + k * 60));
  }
  ctx.fillStyle = "#f4f2f8";
  ctx.font = `600 44px ${font}`;
  ctx.fillText(`Against the crowd ${data.againstMajority.count} of ${data.againstMajority.of} times`, 110, 1600);

  // Footer with logo
  try {
    const img = new Image();
    img.src = "/club-logo.jpeg";
    await img.decode();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(110, 1700, 130, 130, 24);
    ctx.fill();
    ctx.drawImage(img, 115, 1705, 120, 120);
  } catch {
    /* logo optional */
  }
  ctx.fillStyle = "#f4f2f8";
  ctx.font = `700 40px ${font}`;
  ctx.fillText("Data Science Club", 270, 1755);
  ctx.fillStyle = "#a7a2b8";
  ctx.font = `500 34px ${font}`;
  ctx.fillText(`Orientation · n = ${data.n} people`, 270, 1805);

  return new Promise((resolve) => cv.toBlob((b) => resolve(b), "image/png"));
}
