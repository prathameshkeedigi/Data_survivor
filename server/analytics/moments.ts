import { DILEMMA_QUESTIONS, OPTION_KEYS, QUESTION_BY_ID, type OptionKey } from "../../shared/questions";
import type { GroupsMoment, MomentCard, PatternBest, PatternMoment, PredictionMoment, SpreadMoment, SpreadQuestion, TooFew } from "../../shared/moments";
import type { OptionCounts } from "../../shared/types";
import { mulberry32 } from "../sim/rng";

export type Row = Record<string, OptionKey | null | undefined>;
export type Answers = Map<string, Row>;

export const MIN_N = { spread: 20, pattern: 40, groups: 40, prediction: 60 };

const NUM: Record<string, number> = Object.fromEntries(DILEMMA_QUESTIONS.map((q, i) => [q.id, i + 1]));
const optText = (qid: string, k: OptionKey) => QUESTION_BY_ID[qid].options.find((o) => o.key === k)!.text;
const roundQids = (round: number) => DILEMMA_QUESTIONS.filter((q) => q.round === round).map((q) => q.id);
const qidsUpTo = (round: number) => DILEMMA_QUESTIONS.filter((q) => q.round <= round).map((q) => q.id);
const respondents = (ans: Answers, qids: string[]) => [...ans.entries()].filter(([, r]) => qids.some((q) => r[q]));

/** Private per-player data rides along as a non-enumerable property, so it never ends up in JSON. */
function withPrivate<T extends object, P>(obj: T, priv: P): T & { readonly _private: P } {
  Object.defineProperty(obj, "_private", { value: priv, enumerable: false });
  return obj as T & { readonly _private: P };
}

function tooFew(moment: TooFew["moment"], n: number, need: number): TooFew {
  return {
    kind: "too_few",
    moment,
    n,
    need,
    sentence: `Only ${n} people answered — we need at least ${need} for this chart to mean anything. Small samples mislead.`,
  };
}

// ---------------- 1. Spread ----------------

export function splitLabel(pcts: number[]): SpreadQuestion["label"] {
  const top = Math.max(...pcts);
  if (top >= 55) return "strong favourite";
  if (top <= 35) return "near-even split";
  return "leaning one way";
}

export function spreadMoment(ans: Answers, round: number) {
  const qids = roundQids(round);
  const people = respondents(ans, qids);
  if (people.length < MIN_N.spread) return tooFew("spread", people.length, MIN_N.spread);
  const questions: SpreadQuestion[] = qids.map((qid) => {
    const counts: OptionCounts = { A: 0, B: 0, C: 0, D: 0 };
    for (const [, r] of people) if (r[qid]) counts[r[qid]!]++;
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const pct = Object.fromEntries(OPTION_KEYS.map((k) => [k, total ? Math.round((100 * counts[k]) / total) : 0])) as Record<OptionKey, number>;
    const p = total ? Math.max(...Object.values(counts)) / total : 0;
    const q = QUESTION_BY_ID[qid];
    return {
      qid,
      num: NUM[qid],
      prompt: q.prompt,
      options: q.options.map(({ key, text }) => ({ key, text })),
      counts,
      pct,
      label: splitLabel(Object.values(pct)),
      moe: total ? Math.round(196 * Math.sqrt((p * (1 - p)) / total)) : 0,
    };
  });
  const byTop = [...questions].sort((a, b) => Math.max(...Object.values(a.pct)) - Math.max(...Object.values(b.pct)));
  const most = byTop[0];
  const clearest = byTop[byTop.length - 1];
  const callout = `Most split: Q${most.num} (top answer only ${Math.max(...Object.values(most.pct))}%). Clearest favourite: Q${clearest.num} (${Math.max(...Object.values(clearest.pct))}% picked one answer).`;
  const moment: SpreadMoment = {
    kind: "spread",
    n: people.length,
    questions,
    callout,
    sentence: "Spread is how different people's answers are. It tells you whether an average tells the whole story.",
  };
  const card = (id: string): MomentCard => {
    const r = ans.get(id);
    const mine = questions.filter((q) => r?.[q.qid]).map((q) => ({ q, opt: r![q.qid]!, pct: q.pct[r![q.qid]!] }));
    if (!mine.length) return { kind: "none", reason: "You didn't answer this round." };
    const rarest = mine.sort((a, b) => a.pct - b.pct)[0];
    return { kind: "spread", num: rarest.q.num, prompt: rarest.q.prompt, text: optText(rarest.q.qid, rarest.opt), pct: rarest.pct };
  };
  return withPrivate(moment, { card });
}

// ---------------- 2. Patterns ----------------

interface Combo {
  qa: string;
  qb: string;
  a: OptionKey;
  b: OptionKey;
  lift: number;
  cAB: number;
  cA: number;
  cB: number;
  m: number;
}

function bestCombo(cols: Record<string, (OptionKey | null)[]>, qids: string[]): Combo | null {
  let best: Combo | null = null;
  for (let i = 0; i < qids.length; i++) {
    for (let j = i + 1; j < qids.length; j++) {
      const A = cols[qids[i]];
      const B = cols[qids[j]];
      const cAB: Record<string, number> = {};
      const cA: Record<string, number> = {};
      const cB: Record<string, number> = {};
      let m = 0;
      for (let r = 0; r < A.length; r++) {
        const a = A[r];
        const b = B[r];
        if (!a || !b) continue;
        m++;
        cA[a] = (cA[a] ?? 0) + 1;
        cB[b] = (cB[b] ?? 0) + 1;
        cAB[a + b] = (cAB[a + b] ?? 0) + 1;
      }
      if (m < 20) continue;
      for (const key in cAB) {
        const both = cAB[key];
        if (both < 5) continue;
        const a = key[0] as OptionKey;
        const b = key[1] as OptionKey;
        const lift = both / cA[a] / (cB[b] / m);
        if (!best || lift > best.lift + 1e-12 || (Math.abs(lift - best.lift) <= 1e-12 && both > best.cAB)) {
          best = { qa: qids[i], qb: qids[j], a, b, lift, cAB: both, cA: cA[a], cB: cB[b], m };
        }
      }
    }
  }
  return best;
}

export function patternMoment(ans: Answers, round: number, seed: number) {
  const qids = qidsUpTo(round);
  const people = respondents(ans, qids);
  if (people.length < MIN_N.pattern) return tooFew("pattern", people.length, MIN_N.pattern);
  const cols: Record<string, (OptionKey | null)[]> = {};
  for (const q of qids) cols[q] = people.map(([, r]) => r[q] ?? null);
  const found = bestCombo(cols, qids);

  let best: PatternBest | null = null;
  if (found && found.lift > 1.15) {
    // Shuffle check: break every link between questions and see how often a pattern this strong appears by chance.
    const rand = mulberry32(seed);
    const SHUFFLES = 200;
    let asStrong = 0;
    for (let s = 0; s < SHUFFLES; s++) {
      const shuffled: typeof cols = {};
      for (const q of qids) {
        const c = [...cols[q]];
        for (let i = c.length - 1; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1));
          [c[i], c[j]] = [c[j], c[i]];
        }
        shuffled[q] = c;
      }
      const sb = bestCombo(shuffled, qids);
      if (sb && sb.lift >= found.lift) asStrong++;
    }
    const matrix = OPTION_KEYS.map((a) =>
      OPTION_KEYS.map((b) => {
        let c = 0;
        for (let r = 0; r < people.length; r++) if (cols[found.qa][r] === a && cols[found.qb][r] === b) c++;
        return c >= 5 ? c : 0;
      }),
    );
    best = {
      qa: found.qa,
      qb: found.qb,
      numA: NUM[found.qa],
      numB: NUM[found.qb],
      promptA: QUESTION_BY_ID[found.qa].prompt,
      promptB: QUESTION_BY_ID[found.qb].prompt,
      optA: found.a,
      optB: found.b,
      textA: optText(found.qa, found.a),
      textB: optText(found.qb, found.b),
      lift: Math.round(found.lift * 100) / 100,
      countBoth: found.cAB,
      pctBGivenA: Math.round((100 * found.cAB) / found.cA),
      pctB: Math.round((100 * found.cB) / found.m),
      likelyReal: asStrong / SHUFFLES <= 0.05,
      matrix,
      optionsA: QUESTION_BY_ID[found.qa].options.map((o) => o.text),
      optionsB: QUESTION_BY_ID[found.qb].options.map((o) => o.text),
    };
  }
  const moment: PatternMoment = {
    kind: "pattern",
    n: people.length,
    best,
    sentence: best
      ? `People who chose "${best.textA}" on Q${best.numA} were ${best.lift.toFixed(1)}× as likely to choose "${best.textB}" on Q${best.numB}.`
      : "No strong patterns in this room — and finding that out is also data science.",
  };
  const card = (id: string): MomentCard => {
    if (!best) return { kind: "none", reason: "No strong pattern this time." };
    const r = ans.get(id);
    const a = r?.[best.qa];
    const b = r?.[best.qb];
    if (!a || !b) return { kind: "none", reason: `You skipped Q${best.numA} or Q${best.numB}.` };
    let same = 0;
    for (const [, row] of people) if (row[best.qa] === a && row[best.qb] === b) same++;
    return { kind: "pattern", numA: best.numA, numB: best.numB, same, pct: Math.round((100 * same) / people.length), fewerThan5: same < 5 };
  };
  return withPrivate(moment, { card });
}

// ---------------- 3. Groups ----------------

function oneHot(rows: Row[], qids: string[]): number[][] {
  return rows.map((r) => qids.flatMap((q) => OPTION_KEYS.map((k) => (r[q] === k ? 1 : 0))));
}

/** Top-2 principal components by power iteration with deflation. Deterministic for a seed. */
function pca2(X: number[][], seed: number): number[][] {
  const n = X.length;
  const d = X[0].length;
  const mean = Array(d).fill(0);
  for (const row of X) for (let j = 0; j < d; j++) mean[j] += row[j] / n;
  const C = X.map((row) => row.map((v, j) => v - mean[j]));
  const cov = Array.from({ length: d }, () => Array(d).fill(0));
  for (const row of C) for (let i = 0; i < d; i++) if (row[i] !== 0) for (let j = 0; j < d; j++) cov[i][j] += (row[i] * row[j]) / n;
  const rand = mulberry32(seed);
  const comps: number[][] = [];
  for (let c = 0; c < 2; c++) {
    let v = Array.from({ length: d }, () => rand() - 0.5);
    for (let it = 0; it < 200; it++) {
      const w = cov.map((r) => r.reduce((s, x, j) => s + x * v[j], 0));
      for (const prev of comps) {
        const dot = w.reduce((s, x, j) => s + x * prev[j], 0);
        for (let j = 0; j < d; j++) w[j] -= dot * prev[j];
      }
      const norm = Math.hypot(...w) || 1;
      v = w.map((x) => x / norm);
    }
    // fix the sign so repeated runs agree
    const big = v.reduce((bi, x, j) => (Math.abs(x) > Math.abs(v[bi]) ? j : bi), 0);
    if (v[big] < 0) v = v.map((x) => -x);
    comps.push(v);
  }
  return C.map((row) => comps.map((v) => row.reduce((s, x, j) => s + x * v[j], 0)));
}

const dist2 = (a: number[], b: number[]) => a.reduce((s, x, j) => s + (x - b[j]) ** 2, 0);

function kmeans(X: number[][], k: number, rand: () => number) {
  // k-means++ seeding
  const centers = [X[Math.floor(rand() * X.length)].slice()];
  while (centers.length < k) {
    const d = X.map((x) => Math.min(...centers.map((c) => dist2(x, c))));
    const sum = d.reduce((a, b) => a + b, 0);
    let r = rand() * sum;
    let idx = 0;
    for (; idx < d.length - 1; idx++) {
      r -= d[idx];
      if (r <= 0) break;
    }
    centers.push(X[idx].slice());
  }
  let assign = new Array(X.length).fill(0);
  for (let it = 0; it < 40; it++) {
    const next = X.map((x) => {
      let best = 0;
      let bd = Infinity;
      centers.forEach((c, i) => {
        const dd = dist2(x, c);
        if (dd < bd) {
          bd = dd;
          best = i;
        }
      });
      return best;
    });
    const same = next.every((a, i) => a === assign[i]);
    assign = next;
    for (let c = 0; c < k; c++) {
      const members = X.filter((_, i) => assign[i] === c);
      if (members.length) centers[c] = members[0].map((_, j) => members.reduce((s, m) => s + m[j], 0) / members.length);
    }
    if (same && it > 0) break;
  }
  const inertia = X.reduce((s, x, i) => s + dist2(x, centers[assign[i]]), 0);
  return { assign, inertia };
}

/** Mean silhouette over a fixed sample of up to 150 points (full n² is too slow on a 0.1-CPU host). */
function silhouette(X: number[][], assign: number[], k: number): number {
  const n = X.length;
  const step = Math.max(1, Math.floor(n / 150));
  let total = 0;
  let used = 0;
  for (let i = 0; i < n; i += step) {
    used++;
    const sums = new Array(k).fill(0);
    const counts = new Array(k).fill(0);
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      sums[assign[j]] += Math.sqrt(dist2(X[i], X[j]));
      counts[assign[j]]++;
    }
    const own = assign[i];
    if (counts[own] === 0) continue;
    const a = sums[own] / counts[own];
    let b = Infinity;
    for (let c = 0; c < k; c++) if (c !== own && counts[c]) b = Math.min(b, sums[c] / counts[c]);
    total += b === Infinity ? 0 : (b - a) / Math.max(a, b);
  }
  return total / used;
}

export function groupsMoment(ans: Answers, round: number, seed: number) {
  const qids = qidsUpTo(round);
  const people = respondents(ans, qids);
  if (people.length < MIN_N.groups) return tooFew("groups", people.length, MIN_N.groups);
  const X = oneHot(people.map(([, r]) => r), qids);
  const P = pca2(X, seed);

  // Pick k in 2–4 by silhouette; a weak best means "no clear groups".
  const rand = mulberry32(seed + 1);
  let bestK = 0;
  let bestSil = -1;
  let bestAssign: number[] = [];
  for (let k = 2; k <= 4; k++) {
    let run = kmeans(X, k, rand);
    for (let r = 0; r < 2; r++) {
      const alt = kmeans(X, k, rand);
      if (alt.inertia < run.inertia) run = alt;
    }
    const s = silhouette(X, run.assign, k);
    if (s > bestSil + 1e-9) {
      bestSil = s;
      bestK = k;
      bestAssign = run.assign;
    }
  }
  const clear = bestSil >= 0.06;
  const assign = clear ? bestAssign : people.map(() => -1);

  // Normalise to 0–1 with a margin.
  const xs = P.map((p) => p[0]);
  const ys = P.map((p) => p[1]);
  const norm = (v: number, lo: number, hi: number) => (hi - lo < 1e-9 ? 0.5 : 0.05 + (0.9 * (v - lo)) / (hi - lo));
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  // Jitter identical answer patterns slightly so dots don't stack exactly.
  const jit = mulberry32(seed + 2);
  const raw = P.map((p, i) => ({
    x: Math.min(1, Math.max(0, norm(p[0], x0, x1) + (jit() - 0.5) * 0.03)),
    y: Math.min(1, Math.max(0, norm(p[1], y0, y1) + (jit() - 0.5) * 0.03)),
    g: assign[i],
    id: people[i][0],
  }));
  // Sort so the order of dots says nothing about join order.
  raw.sort((a, b) => a.x - b.x || a.y - b.y);
  const index = new Map(raw.map((p, i) => [p.id, i]));
  const points = raw.map(({ x, y, g }) => ({ x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000, g }));

  const groups: GroupsMoment["groups"] = [];
  if (clear) {
    const overall = X[0].map((_, j) => X.reduce((s, x) => s + x[j], 0) / X.length);
    for (let g = 0; g < bestK; g++) {
      const members = X.filter((_, i) => assign[i] === g);
      if (!members.length) continue;
      const share = overall.map((_, j) => members.reduce((s, m) => s + m[j], 0) / members.length);
      const top = share
        .map((s, j) => ({ j, lift: s - overall[j] }))
        .sort((a, b) => b.lift - a.lift)
        .slice(0, 2)
        .map(({ j }) => {
          const qid = qids[Math.floor(j / 4)];
          return { num: NUM[qid], text: optText(qid, OPTION_KEYS[j % 4]) };
        });
      const small = members.length < 5;
      groups.push({ id: g, size: members.length, label: small ? null : `Often chose: ${top[0].text}`, top: small ? [] : top });
    }
  }
  const moment: GroupsMoment = {
    kind: "groups",
    n: people.length,
    points,
    groups,
    sentence: clear
      ? "Each dot is one person. People who answered alike sit close together — and the colours are groups the computer found on its own."
      : "Each dot is one person. This room is a smooth spread, with no obvious groups.",
  };
  const rows = new Map(people);
  const card = (id: string): MomentCard => {
    const i = index.get(id);
    if (i === undefined) return { kind: "none", reason: "You joined after these questions." };
    const mine = rows.get(id)!;
    let similar = 0;
    for (const [other, r] of people) {
      if (other === id) continue;
      let match = 0;
      for (const q of qids) if (mine[q] && mine[q] === r[q]) match++;
      if (match >= Math.ceil(qids.length * 0.75)) similar++;
    }
    const g = points[i].g;
    return { kind: "groups", index: i, group: g, groupLabel: groups.find((x) => x.id === g)?.label ?? null, similar };
  };
  return withPrivate(moment, { card, index });
}

// ---------------- 4. Prediction ----------------

export function predictionMoment(ans: Answers, target: string, _round: number, seed = 2026) {
  const features = DILEMMA_QUESTIONS.map((q) => q.id).filter((q) => q !== target);
  const people = [...ans.entries()].filter(([, r]) => r[target]);
  const n = people.length;
  if (n < MIN_N.prediction) return tooFew("prediction", n, MIN_N.prediction);
  const K = 5;
  const overall: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const [, r] of people) overall[r[target]!]++;
  const lazyCount = Math.max(...Object.values(overall));

  // Neighbours depend only on earlier answers, so find them once.
  // Leave-one-out: person i is never their own neighbour, and their own target answer is never read.
  const neighbours: number[][] = [];
  for (let i = 0; i < n; i++) {
    const ri = people[i][1];
    const sims: { j: number; s: number }[] = [];
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const rj = people[j][1];
      let s = 0;
      for (const f of features) if (ri[f] && ri[f] === rj[f]) s++;
      sims.push({ j, s });
    }
    sims.sort((a, b) => b.s - a.s || a.j - b.j);
    neighbours.push(sims.slice(0, K).map((x) => x.j));
  }
  const accuracy = (targets: OptionKey[]) => {
    let correct = 0;
    for (let i = 0; i < n; i++) {
      const votes: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
      for (const j of neighbours[i]) votes[targets[j]]++;
      const guess = OPTION_KEYS.reduce((best, k) => (votes[k] > votes[best] || (votes[k] === votes[best] && overall[k] > overall[best]) ? k : best), "A" as OptionKey);
      if (guess === targets[i]) correct++;
    }
    return correct;
  };
  const targets = people.map(([, r]) => r[target]!);
  const correct = accuracy(targets);
  const neighboursSame = new Map<string, number>();
  people.forEach(([id], i) => neighboursSame.set(id, neighbours[i].filter((j) => targets[j] === targets[i]).length));

  // Shuffle check: with answers shuffled, the computer has nothing real to learn. How often does it do this well anyway?
  const rand = mulberry32(seed);
  const SHUFFLES = 200;
  let asGood = 0;
  for (let s = 0; s < SHUFFLES; s++) {
    const t = [...targets];
    for (let i = t.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [t[i], t[j]] = [t[j], t[i]];
    }
    if (accuracy(t) >= correct) asGood++;
  }
  const lazyPct = Math.round((100 * lazyCount) / n);
  const smartPct = Math.round((100 * correct) / n);
  const beatsLazy = smartPct >= lazyPct + 5 && asGood / SHUFFLES <= 0.05;
  const moment: PredictionMoment = {
    kind: "prediction",
    n,
    qid: target,
    num: NUM[target],
    k: K,
    lazyPct,
    smartPct,
    beatsLazy,
    sentence: beatsLazy
      ? "The computer learned something real from your earlier answers. A prediction only matters if it beats the lazy guess."
      : "The computer was no better than the lazy guess. Your choices are hard to predict — and that is a result too.",
  };
  const card = (id: string): MomentCard => {
    const r = ans.get(id);
    const mine = r?.[target];
    if (!mine) return { kind: "none", reason: `You skipped Q${NUM[target]}.` };
    return { kind: "prediction", same: neighboursSame.get(id) ?? 0, k: K, myText: optText(target, mine) };
  };
  return withPrivate(moment, { card });
}

/** The data moment shown after each round. */
export function momentForRound(ans: Answers, round: number, seed = 2026) {
  if (round === 1) return spreadMoment(ans, 1);
  if (round === 2) return patternMoment(ans, 2, seed);
  if (round === 3) return groupsMoment(ans, 3, seed);
  return predictionMoment(ans, "q12", 4, seed);
}
