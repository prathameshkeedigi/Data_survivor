import { io, type Socket } from "socket.io-client";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer, type Tuning } from "../../server/server";

export const HOST_PASSWORD = "test-pass-123";

export async function start(tuning: Partial<Tuning> = {}) {
  const webDir = mkdtempSync(join(tmpdir(), "ds-web-"));
  for (const f of ["index.html", "screen.html", "host.html"]) writeFileSync(join(webDir, f), "<html></html>");
  return startServer(
    { port: 0, hostPassword: HOST_PASSWORD, webDir },
    { questionMs: 3000, minSceneGapMs: 50, tickMs: 25, countThrottleMs: 500, backupMs: 100, ...tuning },
  );
}

export type Logged = Socket & { log: { ev: string; args: any[]; at: number }[] };

export function client(url: string, transports: ("websocket" | "polling")[] = ["websocket"]): Logged {
  const s = io(url, { transports, forceNew: true, reconnection: false }) as Logged;
  s.log = [];
  s.onAny((ev, ...args) => s.log.push({ ev, args, at: Date.now() }));
  return s;
}

export function connected(s: Socket) {
  return new Promise<void>((resolve, reject) => {
    if (s.connected) return resolve();
    s.once("connect", () => resolve());
    s.once("connect_error", reject);
  });
}

export function call<T = any>(s: Socket, ev: string, data?: unknown): Promise<T> {
  return new Promise((resolve) => s.emit(ev, data, resolve));
}

export function waitFor<T = any>(s: Logged, ev: string, pred: (d: any) => boolean = () => true, timeoutMs = 4000): Promise<T> {
  return new Promise((resolve, reject) => {
    const hit = [...s.log].reverse().find((l) => l.ev === ev && pred(l.args[0]));
    if (hit) return resolve(hit.args[0]);
    const timer = setTimeout(() => {
      s.off(ev, handler);
      reject(new Error(`timeout waiting for ${ev}`));
    }, timeoutMs);
    const handler = (d: any) => {
      if (pred(d)) {
        clearTimeout(timer);
        s.off(ev, handler);
        resolve(d);
      }
    };
    s.on(ev, handler);
  });
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function host(url: string) {
  const h = client(url);
  await connected(h);
  const r = await call(h, "host:login", { password: HOST_PASSWORD });
  if (!r.ok) throw new Error("host login failed");
  return h;
}

export async function player(url: string, nickname: string) {
  const p = client(url);
  await connected(p);
  const r = await call(p, "player:join", { nickname });
  return Object.assign(p, { me: r });
}

/** Host presses "next" until the scene matches. Locks with suggested cutoffs; winners with default. */
export async function hostTo(
  h: Logged,
  match: (scene: any) => boolean,
  onQuestion?: (qid: string) => Promise<void>,
  opts: { keepAll?: boolean } = {},
) {
  for (let i = 0; i < 120; i++) {
    await waitFor(h, "state");
    const sc = h.log.filter((l) => l.ev === "state").at(-1)!.args[0];
    if (match(sc.scene)) return sc;
    if (sc.scene.type === "question" && sc.votingOpen && onQuestion) await onQuestion(sc.scene.qid);
    if (sc.scene.type === "results" && !sc.host.locked) await call(h, "host:action", { type: "lockSurvivors", keep: opts.keepAll ? Math.max(1, sc.host.activeCount) : sc.host.suggestedKeep });
    if (sc.scene.type === "finale_results" && !sc.host.winnersLocked)
      await call(h, "host:action", { type: "lockWinners", count: Math.max(1, Math.min(10, sc.host.finalists)) });
    await sleep(60);
    const states = () => h.log.filter((l) => l.ev === "state").length;
    const before = states();
    const r = await call(h, "host:action", { type: "advance" });
    if (!r.ok) throw new Error(`advance failed: ${r.error} at ${JSON.stringify(sc.scene)}`);
    for (let t = 0; t < 200 && states() <= before; t++) await sleep(10);
  }
  throw new Error("scene not reached");
}
