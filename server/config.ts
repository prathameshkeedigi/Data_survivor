export interface Config {
  port: number;
  hostPassword: string;
  /** Folder with the built website (index.html, screen.html, host.html). */
  webDir: string;
  /** Optional timing overrides (rehearsal / event-day tweaks without a code change). */
  tuning?: { questionMs?: number; finaleMs?: number };
}

function optionalMs(env: Record<string, string | undefined>, name: string): number | undefined {
  const raw = env[name];
  if (raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1000 || n > 600_000) throw new Error(`${name} must be a whole number of milliseconds (1000–600000), got "${raw}"`);
  return n;
}

export function loadConfig(env: Record<string, string | undefined>): Config {
  const hostPassword = env.HOST_PASSWORD;
  if (!hostPassword) throw new Error("HOST_PASSWORD is not set. Set it in the hosting dashboard before starting.");
  if (hostPassword.length < 8) throw new Error("HOST_PASSWORD must be at least 8 characters.");
  const port = env.PORT ? Number(env.PORT) : 3000;
  if (!Number.isInteger(port) || port < 0) throw new Error(`PORT is invalid: ${env.PORT}`);
  const tuning: Config["tuning"] = {};
  const questionMs = optionalMs(env, "QUESTION_MS");
  const finaleMs = optionalMs(env, "FINALE_MS");
  if (questionMs) tuning.questionMs = questionMs;
  if (finaleMs) tuning.finaleMs = finaleMs;
  return { port, hostPassword, webDir: env.WEB_DIR ?? "dist/web", tuning };
}
