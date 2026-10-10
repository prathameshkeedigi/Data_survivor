import { createServer } from "node:http";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { AddressInfo } from "node:net";
import { Server, type Socket } from "socket.io";
import { z } from "zod";
import type { Config } from "./config";
import { createHttpApp } from "./app";
import { Game, SCENES, type GameState } from "./engine/game";
import { cleanNickname } from "./nickname";
import { hostView, playerView, screenView, viewContext, type ServerMeta } from "./views";
import type { CountUpdate } from "../shared/views";
import type { GroupsMoment, MomentCard, WrappedData } from "../shared/moments";
import { momentForRound } from "./analytics/moments";
import { computeWrapped, type WrappedCore } from "./analytics/wrapped";

export interface Tuning {
  questionMs: number;
  finaleMs: number;
  minSceneGapMs: number;
  tickMs: number;
  /** How often answer/join counts go to host + projector. */
  countThrottleMs: number;
  /** How often the host browser receives a full backup. */
  backupMs: number;
  maxPlayers: number;
  /** Per-connection token bucket. */
  rateBurst: number;
  ratePerSec: number;
  /** Test only: make every analytics calculation throw. */
  analyticsFault: boolean;
}

export const DEFAULT_TUNING: Tuning = {
  questionMs: 20_000,
  finaleMs: 25_000,
  minSceneGapMs: 600,
  tickMs: 100,
  countThrottleMs: 500,
  backupMs: 5_000,
  maxPlayers: 800,
  rateBurst: 20,
  ratePerSec: 10,
  analyticsFault: false,
};

type Ack = (res: unknown) => void;
type Role = "player" | "screen" | "host";
interface SocketData {
  role?: Role;
  playerId?: string;
  tokens: number;
  lastRefill: number;
  badCodes: number;
}

const JoinSchema = z.object({ nickname: z.string().max(10_000) });
const ResumeSchema = z.union([z.object({ token: z.string().min(1).max(200) }), z.object({ code: z.string().min(1).max(10) })]);
const AnswerSchema = z.object({ qid: z.string().max(20), option: z.string().max(2) });
const LoginSchema = z.object({ password: z.string().max(500).optional(), hostKey: z.string().max(200).optional() });
const BackupSchema = z.looseObject({
  state: z.looseObject({
    players: z.record(z.string(), z.any()),
    joinOrder: z.array(z.string()),
    answers: z.record(z.string(), z.any()),
    sceneIndex: z.number().int().min(0).max(SCENES.length - 1),
  }),
  meta: z.object({ rehearsal: z.boolean(), joinsLocked: z.boolean() }).partial().optional(),
});
const HostActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("advance") }),
  z.object({ type: z.literal("back") }),
  z.object({ type: z.literal("pause") }),
  z.object({ type: z.literal("resume") }),
  z.object({ type: z.literal("lockSurvivors"), keep: z.number() }),
  z.object({ type: z.literal("previewCutoff"), keep: z.number().int().min(1) }),
  z.object({ type: z.literal("lockWinners"), count: z.number(), hide: z.array(z.string()).max(50).optional() }),
  z.object({ type: z.literal("lockJoins") }),
  z.object({ type: z.literal("unlockJoins") }),
  z.object({ type: z.literal("setRehearsal"), on: z.boolean() }),
  z.object({ type: z.literal("reset"), confirm: z.literal("RESET") }),
  z.object({ type: z.literal("restore"), backup: BackupSchema }),
]);

const sha = (s: string) => createHash("sha256").update(s).digest();

export async function startServer(config: Config, tuningOverrides: Partial<Tuning> = {}) {
  const t: Tuning = { ...DEFAULT_TUNING, ...tuningOverrides };
  const app = createHttpApp(config);
  const http = createServer(app);
  const io = new Server(http, {
    maxHttpBufferSize: 5e6, // the host's restore payload; everything else is tiny and rate-limited
    pingInterval: 10_000,
    pingTimeout: 20_000,
    serveClient: false,
    perMessageDeflate: false,
  });

  const gameOpts = () => ({ now: Date.now, questionMs: t.questionMs, finaleMs: t.finaleMs, minSceneGapMs: t.minSceneGapMs });
  let game = new Game(gameOpts());
  const meta: ServerMeta = { rehearsal: true, joinsLocked: false, moments: {}, wrapped: () => null };
  let wrappedCache: Map<string, WrappedCore> | null = null;

  /** Data moments are computed as soon as a round's results freeze, so they're ready before the host needs them. */
  function refreshAnalytics() {
    for (const r of [1, 2, 3, 4]) {
      if (!game.roundResults(r) || meta.moments[r] !== undefined) continue;
      const t0 = Date.now();
      try {
        if (t.analyticsFault) throw new Error("injected analytics fault");
        const m = momentForRound(game.answersTable(), r);
        const priv = (m as { _private?: { card: (id: string) => MomentCard } })._private;
        meta.moments[r] = { screen: m, perPlayer: (id) => (priv ? priv.card(id) : { kind: "none", reason: m.sentence }) };
        console.log(`moment ${r} (${m.kind}) computed in ${Date.now() - t0} ms`);
      } catch (err) {
        console.error(`moment ${r} failed`, err);
        meta.moments[r] = "failed";
      }
    }
    const sc = game.scene;
    if ((sc.type === "recap" || sc.type === "wrapped") && !wrappedCache) {
      try {
        wrappedCache = computeWrapped(game.answersTable());
      } catch (err) {
        console.error("wrapped failed", err);
        wrappedCache = new Map();
      }
    }
  }

  meta.wrapped = (id: string): WrappedData | null => {
    const core = wrappedCache?.get(id);
    const p = game.getPlayer(id);
    if (!core || !p) return null;
    const g = meta.moments[3];
    let map: WrappedData["map"] = null;
    if (g && g !== "failed" && (g.screen as GroupsMoment).kind === "groups") {
      const card = g.perPlayer(id) as MomentCard;
      if (card.kind === "groups") map = { points: (g.screen as GroupsMoment).points, myIndex: card.index, groupLabel: card.groupLabel };
    }
    const status = game.winners().some((w) => w.id === id) ? "winner" : game.finalists().some((f) => f.id === id) ? "finalist" : p.status === "active" ? "survivor" : "analyst";
    return { ...core, map, nickname: p.nickname, status };
  };

  const hooks = { onSceneEntered: (_g: Game, _m: ServerMeta) => refreshAnalytics() };
  const hostKeys = new Set<string>();
  const passwordHash = sha(config.hostPassword);
  let dirty = true;
  let lastCount: CountUpdate = { players: -1, answered: -1 };

  // ---- broadcasting ----
  let pending = false;
  /** Scene-level change: every screen redraws. Never called per answer or per join. */
  function changed() {
    dirty = true;
    if (pending) return;
    pending = true;
    setImmediate(() => {
      pending = false;
      broadcast();
    });
  }

  function sendState(s: Socket) {
    const d = s.data as SocketData;
    if (d.role === "host") s.emit("state", hostView(game, meta));
    else if (d.role === "screen") s.emit("state", screenView(game, meta));
    else if (d.role === "player") s.emit("state", playerView(game, meta, d.playerId));
  }

  function broadcast() {
    const ctx = viewContext(game, meta);
    const hv = hostView(game, meta);
    const sv = screenView(game, meta);
    for (const s of io.of("/").sockets.values()) {
      const d = s.data as SocketData;
      if (d.role === "host") s.emit("state", hv);
      else if (d.role === "screen") s.emit("state", sv);
      else if (d.role === "player") s.emit("state", playerView(game, meta, d.playerId, ctx));
    }
  }

  function sendBackup() {
    io.to("host").emit("host:backup", {
      at: Date.now(),
      state: game.snapshot(),
      meta: { rehearsal: meta.rehearsal, joinsLocked: meta.joinsLocked },
    });
  }

  const timers = [
    setInterval(() => {
      if (game.tick()) changed();
    }, t.tickMs),
    setInterval(() => {
      const sc = game.scene;
      const c: CountUpdate = { players: game.playerCount, answered: sc.type === "question" ? game.answerCount(sc.qid) : 0 };
      if (c.players !== lastCount.players || c.answered !== lastCount.answered) {
        lastCount = c;
        io.to("host").to("screen").emit("count", c);
      }
    }, t.countThrottleMs),
    setInterval(() => {
      if (dirty && io.of("/").adapter.rooms.get("host")?.size) {
        dirty = false;
        sendBackup();
      }
    }, t.backupMs),
  ];

  function afterSceneChange() {
    hooks.onSceneEntered(game, meta);
    changed();
  }

  // ---- connections ----
  io.on("connection", (socket) => {
    const d = socket.data as SocketData;
    d.tokens = t.rateBurst;
    d.lastRefill = Date.now();
    d.badCodes = 0;

    // Per-connection rate limit (hosts are exempt; their actions are few and deliberate).
    socket.use((packet, next) => {
      if (d.role !== "host") {
        const now = Date.now();
        d.tokens = Math.min(t.rateBurst, d.tokens + ((now - d.lastRefill) / 1000) * t.ratePerSec);
        d.lastRefill = now;
        if (d.tokens < 1) {
          const ack = packet[packet.length - 1];
          if (typeof ack === "function") ack({ ok: false, error: "RATE_LIMITED" });
          return;
        }
        d.tokens -= 1;
      }
      next();
    });

    const handle = (ev: string, fn: (data: unknown, ack: Ack) => void) => {
      socket.on(ev, (data: unknown, ack?: unknown) => {
        const reply: Ack = typeof ack === "function" ? (ack as Ack) : () => {};
        try {
          fn(data, reply);
        } catch (err) {
          console.error(`[${ev}]`, err);
          reply({ ok: false, error: "SERVER_ERROR" });
        }
      });
    };

    const bindPlayer = (playerId: string) => {
      d.role = "player";
      d.playerId = playerId;
      socket.join("players");
    };

    handle("player:join", (data, ack) => {
      const parsed = JoinSchema.safeParse(data);
      if (!parsed.success) return ack({ ok: false, error: "BAD_REQUEST" });
      if (d.playerId && game.getPlayer(d.playerId)) {
        const p = game.getPlayer(d.playerId)!;
        return ack({ ok: true, playerId: p.id, token: p.token, rejoinCode: p.rejoinCode, nickname: p.nickname });
      }
      if (meta.joinsLocked) return ack({ ok: false, error: "JOINS_LOCKED" });
      if (game.playerCount >= t.maxPlayers) return ack({ ok: false, error: "ROOM_FULL" });
      const { player } = game.join(cleanNickname(parsed.data.nickname));
      bindPlayer(player.id);
      dirty = true;
      ack({ ok: true, playerId: player.id, token: player.token, rejoinCode: player.rejoinCode, nickname: player.nickname });
      sendState(socket);
    });

    handle("player:resume", (data, ack) => {
      const parsed = ResumeSchema.safeParse(data);
      if (!parsed.success) return ack({ ok: false, error: "BAD_REQUEST" });
      let p;
      if ("token" in parsed.data) p = game.findByToken(parsed.data.token);
      else {
        if (d.badCodes >= 5) return ack({ ok: false, error: "RATE_LIMITED" });
        p = game.findByRejoinCode(parsed.data.code);
        if (!p) d.badCodes++;
      }
      if (!p) return ack({ ok: false, error: "UNKNOWN_PLAYER" });
      bindPlayer(p.id);
      ack({ ok: true, playerId: p.id, token: p.token, rejoinCode: p.rejoinCode, nickname: p.nickname });
      sendState(socket);
    });

    handle("player:answer", (data, ack) => {
      const parsed = AnswerSchema.safeParse(data);
      if (!parsed.success) return ack({ ok: false, error: "BAD_REQUEST" });
      if (!d.playerId) return ack({ ok: false, error: "UNKNOWN_PLAYER" });
      const r = game.submitAnswer(d.playerId, parsed.data.qid, parsed.data.option);
      if (r.ok && !r.duplicate) dirty = true;
      ack(r);
    });

    handle("screen:hello", (_data, ack) => {
      d.role = "screen";
      socket.join("screen");
      ack({ ok: true });
      sendState(socket);
    });

    handle("host:login", (data, ack) => {
      const parsed = LoginSchema.safeParse(data);
      if (!parsed.success) return ack({ ok: false, error: "BAD_REQUEST" });
      const { password, hostKey } = parsed.data;
      const ok = (hostKey !== undefined && hostKeys.has(hostKey)) || (password !== undefined && timingSafeEqual(sha(password), passwordHash));
      if (!ok) return ack({ ok: false, error: "BAD_PASSWORD" });
      const key = hostKey && hostKeys.has(hostKey) ? hostKey : randomBytes(24).toString("base64url");
      hostKeys.add(key);
      d.role = "host";
      socket.join("host");
      ack({ ok: true, hostKey: key });
      sendState(socket);
      socket.emit("count", { players: game.playerCount, answered: 0 });
      socket.emit("host:backup", { at: Date.now(), state: game.snapshot(), meta: { rehearsal: meta.rehearsal, joinsLocked: meta.joinsLocked } });
    });

    handle("host:action", (data, ack) => {
      if (d.role !== "host") return ack({ ok: false, error: "FORBIDDEN" });
      const parsed = HostActionSchema.safeParse(data);
      if (!parsed.success) return ack({ ok: false, error: "BAD_REQUEST" });
      const a = parsed.data;
      switch (a.type) {
        case "advance":
        case "back": {
          const r = a.type === "advance" ? game.advance() : game.back();
          if (r.ok) afterSceneChange();
          return ack(r);
        }
        case "pause":
        case "resume": {
          const r = a.type === "pause" ? game.pause() : game.resume();
          if (r.ok) changed();
          return ack(r);
        }
        case "lockSurvivors": {
          const sc = game.scene;
          if (sc.type !== "results") return ack({ ok: false, error: "WRONG_SCENE" });
          const r = game.lockSurvivors(sc.round, a.keep);
          if (r.ok) changed();
          return ack(r);
        }
        case "previewCutoff": {
          const sc = game.scene;
          if (sc.type !== "results") return ack({ ok: false, error: "WRONG_SCENE" });
          return ack({ ok: true, tiedAtCutoff: game.roundRanking(sc.round, a.keep).tiedAtCutoff });
        }
        case "lockWinners": {
          const r = game.lockWinners(a.count, a.hide ?? []);
          if (r.ok) changed();
          return ack(r);
        }
        case "lockJoins":
        case "unlockJoins":
          meta.joinsLocked = a.type === "lockJoins";
          changed();
          return ack({ ok: true });
        case "setRehearsal":
          meta.rehearsal = a.on;
          changed();
          return ack({ ok: true });
        case "reset":
          game = new Game(gameOpts());
          meta.moments = {};
          wrappedCache = null;
          meta.joinsLocked = false;
          for (const s of io.of("/").sockets.values()) {
            if ((s.data as SocketData).role === "player") (s.data as SocketData).playerId = undefined;
          }
          changed();
          return ack({ ok: true });
        case "restore": {
          try {
            game = Game.restore(a.backup.state as unknown as GameState, gameOpts());
          } catch (err) {
            console.error("restore failed", err);
            return ack({ ok: false, error: "BAD_REQUEST" });
          }
          meta.moments = {};
          wrappedCache = null;
          if (a.backup.meta?.rehearsal !== undefined) meta.rehearsal = a.backup.meta.rehearsal;
          if (a.backup.meta?.joinsLocked !== undefined) meta.joinsLocked = a.backup.meta.joinsLocked;
          afterSceneChange();
          return ack({ ok: true });
        }
      }
    });
  });

  await new Promise<void>((resolve) => http.listen(config.port, resolve));
  const port = (http.address() as AddressInfo).port;

  return {
    url: `http://127.0.0.1:${port}`,
    port,
    io,
    hooks,
    meta,
    game: () => game,
    close: () =>
      new Promise<void>((resolve) => {
        timers.forEach(clearInterval);
        io.close(() => resolve());
      }),
  };
}
