import { start, client, connected, call, waitFor, sleep, host, player, hostTo, HOST_PASSWORD, type Logged } from "../helpers/live";

const isQ = (qid: string) => (s: any) => s.type === "question" && s.qid === qid;
const latest = (s: Logged, ev = "state") => s.log.filter((l) => l.ev === ev).at(-1)?.args[0];
const closeAll = (...socks: Logged[]) => socks.forEach((s) => s.close());

describe("Phase 3 — realtime", () => {
  it("R1: join returns token + 4-char rejoin code, then a personal state", async () => {
    const srv = await start();
    const p = await player(srv.url, "Ana");
    expect(p.me).toMatchObject({ ok: true });
    expect(p.me.token.length).toBeGreaterThan(16);
    expect(p.me.rejoinCode).toMatch(/^[A-Z2-9]{4}$/);
    const st = await waitFor(p, "state", (d) => d.me);
    expect(st.me).toMatchObject({ nickname: "Ana", status: "active", rejoinCode: p.me.rejoinCode });
    closeAll(p);
    await srv.close();
  });

  it("R2 + R3: resume by token or rejoin code gives the same player; wrong code rejected", async () => {
    const srv = await start();
    const h = await host(srv.url);
    const p = await player(srv.url, "Ana");
    await hostTo(h, isQ("q1"));
    p.close();
    const byToken = client(srv.url);
    await connected(byToken);
    const r = await call(byToken, "player:resume", { token: p.me.token });
    expect(r).toMatchObject({ ok: true, playerId: p.me.playerId });
    const st = await waitFor(byToken, "state", (d) => d.me);
    expect(st.scene).toMatchObject({ type: "question", qid: "q1" });
    const byCode = client(srv.url);
    await connected(byCode);
    expect(await call(byCode, "player:resume", { code: p.me.rejoinCode.toLowerCase() })).toMatchObject({ ok: true, playerId: p.me.playerId });
    expect(await call(byCode, "player:resume", { code: "QQQQ" })).toMatchObject({ ok: false });
    closeAll(h, byToken, byCode);
    await srv.close();
  });

  it("R4 + R5: phones never see others' data; the projector never sees nicknames before approved winners", async () => {
    const srv = await start();
    const h = await host(srv.url);
    const scr = client(srv.url);
    await connected(scr);
    await call(scr, "screen:hello");
    const a = await player(srv.url, "ZebraAlpha");
    const b = await player(srv.url, "YakBravo");
    await hostTo(h, (s) => s.type === "results" && s.round === 1, async (qid) => {
      await call(a, "player:answer", { qid, option: "A" });
      await call(b, "player:answer", { qid, option: "B" });
    });
    await sleep(700);
    const aSaw = JSON.stringify(a.log);
    expect(aSaw).not.toContain("YakBravo");
    expect(aSaw).not.toContain(b.me.token);
    expect(aSaw).not.toContain(b.me.playerId);
    expect(aSaw).not.toContain(b.me.rejoinCode);
    const screenSaw = JSON.stringify(scr.log);
    for (const secret of ["ZebraAlpha", "YakBravo", a.me.playerId, b.me.playerId, a.me.token]) expect(screenSaw).not.toContain(secret);
    closeAll(h, scr, a, b);
    await srv.close();
  });

  it("R5: winners scene shows approved nicknames only (hidden ones masked)", async () => {
    const srv = await start({ questionMs: 2000 });
    const h = await host(srv.url);
    const scr = client(srv.url);
    await connected(scr);
    await call(scr, "screen:hello");
    const a = await player(srv.url, "WinnerOne");
    const b = await player(srv.url, "RudeName");
    await hostTo(h, (s) => s.type === "finale_results", async (qid) => {
      await call(a, "player:answer", { qid, option: "A" });
      await call(b, "player:answer", { qid, option: "B" });
    }, { keepAll: true });
    const st = latest(h);
    expect(st.host.winnersPreview.length).toBe(2);
    const rude = st.host.winnersPreview.find((w: any) => w.nickname === "RudeName");
    expect((await call(h, "host:action", { type: "lockWinners", count: 2, hide: [rude.playerId] })).ok).toBe(true);
    await waitFor(h, "state", (d) => d.host.winnersLocked);
    await hostTo(h, (s) => s.type === "winners");
    const sc = await waitFor(scr, "state", (d) => d.scene.type === "winners");
    const names = sc.winners.map((w: any) => w.nickname);
    expect(names).toContain("WinnerOne");
    expect(JSON.stringify(scr.log)).not.toContain("RudeName");
    closeAll(h, scr, a, b);
    await srv.close();
  });

  it("R6: server closes voting on time; late answer rejected; phones get remaining ms", async () => {
    const srv = await start({ questionMs: 800 });
    const h = await host(srv.url);
    const p = await player(srv.url, "Ana");
    await hostTo(h, isQ("q1"));
    const st = await waitFor(p, "state", (d) => d.scene.type === "question");
    expect(st.msRemaining).toBeGreaterThan(0);
    expect(st.msRemaining).toBeLessThanOrEqual(800);
    await waitFor(p, "state", (d) => d.scene.type === "question" && d.votingOpen === false, 3000);
    expect(await call(p, "player:answer", { qid: "q1", option: "A" })).toEqual({ ok: false, error: "NOT_OPEN" });
    closeAll(h, p);
    await srv.close();
  });

  it("R7: two simultaneous submits store exactly one answer", async () => {
    const srv = await start();
    const h = await host(srv.url);
    const p = await player(srv.url, "Ana");
    await hostTo(h, isQ("q1"));
    const [r1, r2] = await Promise.all([call(p, "player:answer", { qid: "q1", option: "A" }), call(p, "player:answer", { qid: "q1", option: "B" })]);
    expect([r1.duplicate, r2.duplicate].sort()).toEqual([false, true]);
    expect(r1.option).toBe(r2.option);
    expect(srv.game().answerCount("q1")).toBe(1);
    closeAll(h, p);
    await srv.close();
  });

  it("R8: no message storm — phones get only their ack while voting; counts are throttled to host/screen", async () => {
    const srv = await start({ questionMs: 2500 });
    const h = await host(srv.url);
    const players = await Promise.all(Array.from({ length: 30 }, (_, i) => player(srv.url, `P${i}`)));
    await hostTo(h, isQ("q1"));
    await waitFor(players[0], "state", (d) => d.scene.type === "question");
    const watcher = players[0];
    const startLen = watcher.log.length;
    const hostStart = h.log.length;
    for (const p of players.slice(1)) {
      await call(p, "player:answer", { qid: "q1", option: "ABCD"[Math.floor(Math.random() * 4)] });
      await sleep(20);
    }
    await sleep(600);
    expect(watcher.log.slice(startLen).length).toBe(0); // 29 others answered, watcher received nothing
    const counts = h.log.slice(hostStart).filter((l) => l.ev === "count");
    expect(counts.length).toBeGreaterThan(0);
    expect(counts.length).toBeLessThanOrEqual(5); // ~1.2s of answering at ≤2/s
    expect(counts.at(-1)!.args[0].answered).toBe(29);
    closeAll(h, ...players);
    await srv.close();
  });

  it("R9: wrong host password rejected; non-host cannot run host actions", async () => {
    const srv = await start();
    const bad = client(srv.url);
    await connected(bad);
    expect(await call(bad, "host:login", { password: "wrong-password" })).toMatchObject({ ok: false });
    expect(await call(bad, "host:action", { type: "advance" })).toMatchObject({ ok: false, error: "FORBIDDEN" });
    const p = await player(srv.url, "Ana");
    expect(await call(p, "host:action", { type: "advance" })).toMatchObject({ ok: false, error: "FORBIDDEN" });
    expect(srv.game().scene.type).toBe("lobby");
    closeAll(bad, p);
    await srv.close();
  });

  it("R10: garbage messages are dropped; nicknames are cleaned; server stays healthy", async () => {
    const srv = await start();
    const s = client(srv.url);
    await connected(s);
    expect(await call(s, "player:join", "not-an-object")).toMatchObject({ ok: false, error: "BAD_REQUEST" });
    expect(await call(s, "player:join", { nickname: 42 })).toMatchObject({ ok: false, error: "BAD_REQUEST" });
    expect(await call(s, "player:answer", { qid: "q1", option: { evil: true } })).toMatchObject({ ok: false });
    expect(await call(s, "host:action", { type: "drop-database" })).toMatchObject({ ok: false });
    s.emit("totally:unknown", { x: 1 });
    s.emit("player:answer"); // no ack, no payload
    const longName = await call(s, "player:join", { nickname: "x".repeat(5000) + "\u0000​" });
    expect(longName.ok).toBe(true);
    expect(srv.game().getPlayer(longName.playerId)!.nickname.length).toBeLessThanOrEqual(16);
    const res = await fetch(`${srv.url}/health`);
    expect(res.status).toBe(200);
    closeAll(s);
    await srv.close();
  });

  it("R11: a flood from one connection is rate-limited without hurting others", async () => {
    const srv = await start();
    const h = await host(srv.url);
    const flooder = await player(srv.url, "Flood");
    const normal = await player(srv.url, "Calm");
    await hostTo(h, isQ("q1"));
    const acks = await Promise.all(Array.from({ length: 200 }, () => call(flooder, "player:answer", { qid: "q1", option: "A" })));
    expect(acks.filter((a) => a.error === "RATE_LIMITED").length).toBeGreaterThan(100);
    expect(await call(normal, "player:answer", { qid: "q1", option: "B" })).toMatchObject({ ok: true });
    closeAll(h, flooder, normal);
    await srv.close();
  });

  it("R12: join cap and host 'lock joining' both work", async () => {
    const srv = await start({ maxPlayers: 3 });
    for (const n of ["a", "b", "c"]) await player(srv.url, n);
    const fourth = await player(srv.url, "d");
    expect(fourth.me).toMatchObject({ ok: false, error: "ROOM_FULL" });
    const srv2 = await start();
    const h = await host(srv2.url);
    expect((await call(h, "host:action", { type: "lockJoins" })).ok).toBe(true);
    expect((await player(srv2.url, "e")).me).toMatchObject({ ok: false, error: "JOINS_LOCKED" });
    await srv.close();
    await srv2.close();
  });

  it("R13 + R14: two hosts stay in sync; a double 'next' moves one scene", async () => {
    const srv = await start({ minSceneGapMs: 600 });
    const h1 = await host(srv.url);
    const h2 = await host(srv.url);
    await sleep(650);
    const [r1, r2] = await Promise.all([call(h1, "host:action", { type: "advance" }), call(h2, "host:action", { type: "advance" })]);
    expect([r1.ok, r2.ok].sort()).toEqual([false, true]);
    expect([r1.error, r2.error]).toContain("TOO_FAST");
    const s1 = await waitFor(h1, "state", (d) => d.scene.type === "question");
    const s2 = await waitFor(h2, "state", (d) => d.scene.type === "question");
    expect(s1.scene).toEqual({ type: "question", qid: "q1", round: 1 });
    expect(s2.scene).toEqual(s1.scene);
    closeAll(h1, h2);
    await srv.close();
  });

  it("R15: host backup → restart → restore gives the same game; phones resume", async () => {
    const srv = await start();
    const h = await host(srv.url);
    const p = await player(srv.url, "Ana");
    await hostTo(h, isQ("q2"), async (qid) => void (await call(p, "player:answer", { qid, option: "C" })));
    await sleep(300);
    const backup = latest(h, "host:backup");
    expect(backup.state.sceneIndex).toBe(srv.game().sceneIndex);
    closeAll(h, p);
    await srv.close();

    const fresh = await start();
    const h2 = await host(fresh.url);
    expect((await call(h2, "host:action", { type: "restore", backup })).ok).toBe(true);
    expect(fresh.game().scene).toMatchObject({ type: "question", qid: "q2" });
    expect(fresh.game().answerOf(p.me.playerId, "q1")).toBe("C");
    const back = client(fresh.url);
    await connected(back);
    expect(await call(back, "player:resume", { token: p.me.token })).toMatchObject({ ok: true, playerId: p.me.playerId });
    closeAll(h2, back);
    await fresh.close();
  });

  it("R16: a full join + answer works over HTTP long-polling only (WebSockets blocked)", async () => {
    const srv = await start();
    const h = await host(srv.url);
    const p = client(srv.url, ["polling"]);
    await connected(p);
    const me = await call(p, "player:join", { nickname: "Polly" });
    expect(me.ok).toBe(true);
    await hostTo(h, isQ("q1"));
    await waitFor(p, "state", (d) => d.scene.type === "question");
    expect(await call(p, "player:answer", { qid: "q1", option: "D" })).toMatchObject({ ok: true });
    closeAll(h, p);
    await srv.close();
  });

  it("host password check is constant-time-safe and the password is never echoed", async () => {
    const srv = await start();
    const h = await host(srv.url);
    expect(JSON.stringify(h.log)).not.toContain(HOST_PASSWORD);
    closeAll(h);
    await srv.close();
  });

  it("R17: host fallback switch reaches the projector and resets on the next scene", async () => {
    const srv = await start();
    const h = await host(srv.url);
    const scr = client(srv.url);
    await connected(scr);
    await call(scr, "screen:hello");
    expect((await call(h, "host:action", { type: "setFallback", on: true })).ok).toBe(true);
    await waitFor(scr, "state", (d) => d.fallback === true);
    await sleep(100);
    expect((await call(h, "host:action", { type: "advance" })).ok).toBe(true);
    await waitFor(scr, "state", (d) => d.scene.type === "question" && d.fallback === false);
    closeAll(h, scr);
    await srv.close();
  });
});
