// Load test: N simulated phones play a full game against a running server, driven by a bot host.
//
//   npx tsx scripts/swarm.ts --url https://your-app.example --password <HOST_PASSWORD> --n 500 --reset
//   npx tsx scripts/swarm.ts --url https://your-app.example --n 300 --passive     (rehearsal: bots answer, a real host drives)
//
// Checks (Phase 7, L1–L9): everyone joins, no lost or duplicated answers, late answers rejected,
// garbage rejected, scene changes reach phones fast. Exits 1 if any check fails.
// --reset wipes the game first. NEVER use --reset against the live event after the audience has joined.
import { io, type Socket } from "socket.io-client";

const args = Object.fromEntries(
  process.argv.slice(2).reduce<[string, string][]>((acc, a, i, all) => {
    if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : "true"]);
    return acc;
  }, []),
);
const URL_ = args.url ?? "http://127.0.0.1:3000";
const PASSWORD = args.password ?? process.env.HOST_PASSWORD ?? "";
const N = Number(args.n ?? 500);
const MALICIOUS = Number(args.malicious ?? 50);
const RESET = args.reset === "true";
const STOP_AFTER = args.until ?? "wrapped"; // e.g. "moment" to stop early
const HOLD = Number(args.hold ?? 0); // ms to pause on chart scenes (rehearsals / screenshots)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pct = (xs: number[], p: number) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))] : 0);

function connect(transports: ("websocket" | "polling")[] = ["polling", "websocket"]): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = io(URL_, { transports, forceNew: true, reconnection: true, timeout: 20_000 });
    s.once("connect", () => resolve(s));
    s.once("connect_error", (e) => reject(e));
  });
}
const call = <T = any>(s: Socket, ev: string, data?: unknown, timeoutMs = 15_000): Promise<T> =>
  new Promise((resolve) => s.timeout(timeoutMs).emit(ev, data, (err: unknown, res: T) => resolve(err ? ({ ok: false, error: "TIMEOUT" } as T) : res)));

interface Bot {
  i: number;
  s: Socket;
  id: string;
  token: string;
  acked: Map<string, string>; // qid -> option the server confirmed
  lastStateAt: number;
  sceneKey: string;
}

const failures: string[] = [];
const check = (ok: boolean, msg: string) => {
  if (!ok) failures.push(msg);
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
};

/** --passive: bots only join and answer; a real host drives the game (use for rehearsals). Ctrl+C to stop. */
async function passive() {
  console.log(`Passive swarm → ${URL_}  bots=${N}. A real host drives the game. Ctrl+C to stop.`);
  let answered = 0;
  for (let i = 0; i < N; i++) {
    const s = await connect();
    const r = await call(s, "player:join", { nickname: `Bot ${i}` });
    if (!r.ok) {
      console.log("join failed:", r.error);
      continue;
    }
    const done = new Set<string>();
    s.on("connect", () => call(s, "player:resume", { token: r.token }));
    s.on("state", (v: any) => {
      const q = v.question;
      if (!q || !v.votingOpen || done.has(q.id)) return;
      done.add(q.id);
      setTimeout(async () => {
        const res = await call(s, "player:answer", { qid: q.id, option: "ABCD"[Math.floor(Math.random() ** 1.6 * 4)] });
        if (res.ok) answered++;
      }, rand(1000, Math.max(1500, Math.min(12_000, v.msRemaining - 2000))));
    });
    if (i % 50 === 49) console.log(`${i + 1} bots joined`);
  }
  setInterval(() => console.log(`answers so far: ${answered}`), 10_000);
}

async function main() {
  if (args.passive === "true") return passive();
  console.log(`Swarm → ${URL_}  bots=${N}  malicious=${MALICIOUS}`);
  const health = await fetch(`${URL_}/health`).then((r) => r.json());
  console.log("health:", health);

  // Host
  const host = await connect(["websocket"]);
  const login = await call(host, "host:login", { password: PASSWORD });
  if (!login.ok) throw new Error("host login failed — check --password");
  let hostState: any = null;
  let lastBackup: any = null;
  host.on("state", (v) => (hostState = v));
  host.on("host:backup", (b) => (lastBackup = b));
  if (RESET) {
    await call(host, "host:action", { type: "reset", confirm: "RESET" });
    await sleep(300);
  }

  // L1: join burst
  const bots: Bot[] = [];
  const t0 = Date.now();
  const joinErrors: string[] = [];
  await Promise.all(
    Array.from({ length: N }, async (_, i) => {
      await sleep(rand(0, 45_000 * Math.min(1, N / 500)));
      try {
        const s = await connect(i % 10 === 0 ? ["polling"] : ["polling", "websocket"]);
        const r = await call(s, "player:join", { nickname: `Bot ${i}` });
        if (!r.ok) return joinErrors.push(r.error);
        const b: Bot = { i, s, id: r.playerId, token: r.token, acked: new Map(), lastStateAt: 0, sceneKey: "" };
        s.on("state", (v) => {
          b.lastStateAt = Date.now();
          b.sceneKey = JSON.stringify(v.scene) + v.votingOpen;
        });
        s.on("connect", () => call(s, "player:resume", { token: b.token })); // after any reconnect
        bots.push(b);
      } catch (e) {
        joinErrors.push(String(e));
      }
    }),
  );
  const joinSecs = (Date.now() - t0) / 1000;
  check(bots.length === N && joinErrors.length === 0, `L1 ${bots.length}/${N} bots joined in ${joinSecs.toFixed(1)}s (errors: ${joinErrors.length}${joinErrors.length ? " e.g. " + joinErrors[0] : ""})`);

  // L6: malicious connections
  let maliciousAccepted = 0;
  await Promise.all(
    Array.from({ length: MALICIOUS }, async (_, i) => {
      const s = await connect(["websocket"]);
      const attempts = [
        call(s, "host:action", { type: "advance" }),
        call(s, "host:login", { password: "guess" + i }),
        call(s, "player:answer", { qid: "q1", option: "A" }),
        call(s, "player:join", "not-an-object"),
        call(s, "player:resume", { code: "ZZZZ" }),
      ];
      for (let k = 0; k < 60; k++) attempts.push(call(s, "player:answer", { qid: "q1", option: { x: k } }));
      const res = await Promise.all(attempts);
      maliciousAccepted += res.filter((r: any) => r.ok).length;
      s.close();
    }),
  );
  check(maliciousAccepted === 0, `L6 ${MALICIOUS} malicious connections: ${maliciousAccepted} bad requests accepted`);

  // Drive the game
  const latencies: number[] = [];
  let lateRejected = 0;
  let lateAccepted = 0;
  let answerErrors = 0;
  let doubleTapMismatch = 0;
  let reconnects = 0;
  const advance = async () => {
    await sleep(700);
    const before = Date.now();
    const keys = new Map(bots.map((b) => [b, b.sceneKey]));
    const r = await call(host, "host:action", { type: "advance" });
    if (!r.ok) throw new Error(`advance failed: ${r.error}`);
    // L4: time for the change to reach phones
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline && bots.some((b) => b.s.connected && b.sceneKey === keys.get(b))) await sleep(20);
    for (const b of bots) if (b.sceneKey !== keys.get(b)) latencies.push(b.lastStateAt - before);
  };

  for (let step = 0; step < 200; step++) {
    await sleep(150);
    const st = hostState;
    const sc = st.scene;
    process.stdout.write(`\r scene ${st.host.sceneIndex + 1}/${st.host.sceneCount} ${sc.type}${"qid" in sc ? " " + sc.qid : ""}          `);
    if (sc.type === STOP_AFTER) break;
    if (sc.type === "question" && st.votingOpen) {
      const qid = sc.qid;
      const window = Math.min(6000, Math.max(1500, st.msRemaining - 1500));
      const late = new Set(bots.filter(() => Math.random() < 0.05));
      const answering = bots.filter((b) => !late.has(b) && Math.random() > 0.03);
      await Promise.all(
        answering.map(async (b) => {
          await sleep(rand(0, window));
          const opt = "ABCD"[Math.floor(Math.random() ** 1.6 * 4)];
          if (b.i % 10 === 1) {
            // L2: double tap with a different option — first must win
            const [r1, r2] = await Promise.all([call(b.s, "player:answer", { qid, option: opt }), call(b.s, "player:answer", { qid, option: "ABCD"[(("ABCD".indexOf(opt) + 1) % 4)] })]);
            if (r1.ok) b.acked.set(qid, r1.option);
            if (!r1.ok || !r2.ok || r1.option !== r2.option) doubleTapMismatch++;
            return;
          }
          if (b.i % 10 === 2 && step % 3 === 0) {
            // L2: drop the connection mid-question, come back, then answer
            reconnects++;
            b.s.io.engine.close();
            await sleep(rand(200, 1200));
            while (!b.s.connected) await sleep(50);
            await call(b.s, "player:resume", { token: b.token });
          }
          const r = await call(b.s, "player:answer", { qid, option: opt });
          if (r.ok) b.acked.set(qid, r.option);
          else answerErrors++;
        }),
      );
      await advance(); // close voting
      // L2: late answers must be rejected
      await Promise.all(
        [...late].map(async (b) => {
          const r = await call(b.s, "player:answer", { qid, option: "A" });
          if (r.ok) {
            lateAccepted++;
            b.acked.set(qid, r.option);
          } else lateRejected++;
        }),
      );
      continue;
    }
    if (HOLD && ["results", "survivors", "moment", "winners", "recap"].includes(sc.type)) await sleep(HOLD);
    if (sc.type === "results" && !st.host.locked) await call(host, "host:action", { type: "lockSurvivors", keep: st.host.suggestedKeep });
    if (sc.type === "finale_results" && !st.host.winnersLocked)
      await call(host, "host:action", { type: "lockWinners", count: Math.max(1, Math.min(10, st.host.finalists)) });
    await advance();
  }
  console.log("");

  // L3: compare what the server stored with what each bot was told
  await sleep(6000); // wait for a fresh backup (sent every 5 s)
  const stored = lastBackup?.state?.answers ?? {};
  let lost = 0;
  let wrong = 0;
  let total = 0;
  for (const b of bots)
    for (const [qid, opt] of b.acked) {
      total++;
      const rec = stored[qid]?.[b.id];
      if (!rec) lost++;
      else if (rec.option !== opt) wrong++;
    }
  check(lost === 0 && wrong === 0, `L3 ${total} confirmed answers: ${lost} lost, ${wrong} changed after confirmation`);
  check(doubleTapMismatch === 0, `L2 double taps: ${doubleTapMismatch} stored a different answer than the first tap`);
  check(lateAccepted === 0, `L2 late answers: ${lateRejected} rejected, ${lateAccepted} accepted`);
  check(answerErrors === 0, `L2 on-time answers rejected: ${answerErrors} (reconnects simulated: ${reconnects})`);
  const p50 = pct(latencies, 50);
  const p95 = pct(latencies, 95);
  check(p95 < 1000, `L4 scene change reached phones: p50 ${p50} ms, p95 ${p95} ms (${latencies.length} samples)`);
  const after = await fetch(`${URL_}/health`).then((r) => r.json());
  console.log("health after:", after);
  check((after.lagMs ?? 0) < 300, `L5 server event-loop lag ${after.lagMs} ms, memory ${after.rssMb} MB`);

  for (const b of bots) b.s.close();
  host.close();
  console.log(failures.length ? `\n${failures.length} CHECK(S) FAILED` : "\nALL LOAD CHECKS PASSED");
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
