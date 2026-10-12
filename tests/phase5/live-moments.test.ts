import { start, client, connected, call, waitFor, host, player, hostTo, sleep, type Logged } from "../helpers/live";

const latest = (s: Logged) => s.log.filter((l) => l.ev === "state").at(-1)?.args[0];

describe("Phase 5/6 — data moments and Wrapped over the live connection", () => {
  it("A10: each round's moment reaches the projector; phones get a personal card; Wrapped arrives at the end", async () => {
    const srv = await start({ questionMs: 4000 });
    const h = await host(srv.url);
    const scr = client(srv.url);
    await connected(scr);
    await call(scr, "screen:hello");
    const players = await Promise.all(Array.from({ length: 45 }, (_, i) => player(srv.url, `P${i}`)));
    const opts = ["A", "B", "C", "D"];
    const kinds: string[] = [];
    await hostTo(
      h,
      (s) => s.type === "wrapped",
      async (qid) => {
        await Promise.all(players.map((p, i) => call(p, "player:answer", { qid, option: opts[(i * (qid.length + 3) + (i % 7)) % 4] })));
      },
      { keepAll: true },
    );
    await sleep(300);
    for (const l of scr.log) if (l.ev === "state" && l.args[0].scene.type === "moment" && l.args[0].moment) kinds.push(l.args[0].moment.kind);
    // Phase 10: 45 people is enough for all four moments
    expect(kinds).toEqual(expect.arrayContaining(["spread", "pattern", "groups", "prediction"]));
    expect(kinds).not.toContain("too_few");
    const phoneMoment = players[0].log.find((l) => l.ev === "state" && l.args[0].scene.type === "moment" && l.args[0].momentCard);
    expect(phoneMoment).toBeTruthy();
    const w = latest(players[3]).wrapped;
    expect(w).toMatchObject({ nickname: "P3" });
    expect(w.answered).toBeGreaterThan(0);
    expect(w.label.name.length).toBeGreaterThan(0);
    // privacy: the projector never received a player id
    const screenSaw = JSON.stringify(scr.log);
    for (const p of players.slice(0, 10)) expect(screenSaw).not.toContain(p.me.playerId);
    [h, scr, ...players].forEach((s) => s.close());
    await srv.close();
  }, 120_000);

  it("A11: if a calculation fails, the host is told and the projector shows no broken chart", async () => {
    const srv = await start({ analyticsFault: true });
    const h = await host(srv.url);
    const p = await player(srv.url, "Solo");
    await hostTo(h, (s) => s.type === "moment" && s.round === 1, async (qid) => void (await call(p, "player:answer", { qid, option: "A" })));
    const st = await waitFor(h, "state", (d) => d.scene.type === "moment");
    expect(st.host.momentStatus).toBe("failed");
    expect(st.moment).toBeNull();
    [h, p].forEach((s) => s.close());
    await srv.close();
  });
});
