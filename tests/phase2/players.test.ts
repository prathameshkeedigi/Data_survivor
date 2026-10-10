import { setup } from "../helpers/setup";

describe("Phase 2 — player identity", () => {
  it("join gives unique ids, tokens and 4-char rejoin codes; lookups work", () => {
    const { game } = setup();
    const players = Array.from({ length: 500 }, (_, i) => game.join(`p${i}`).player);
    expect(new Set(players.map((p) => p.token)).size).toBe(500);
    expect(new Set(players.map((p) => p.rejoinCode)).size).toBe(500);
    for (const p of players) expect(p.rejoinCode).toMatch(/^[A-HJ-NP-Z2-9]{4}$/); // no 0/O/1/I
    expect(game.findByToken(players[7].token)?.id).toBe(players[7].id);
    expect(game.findByRejoinCode(players[9].rejoinCode.toLowerCase())?.id).toBe(players[9].id);
    expect(game.findByRejoinCode("ZZZZ!")).toBeUndefined();
  });
});
