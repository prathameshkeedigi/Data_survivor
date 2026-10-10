export interface Config {
  port: number;
  hostPassword: string;
  /** Folder with the built website (index.html, screen.html, host.html). */
  webDir: string;
}

export function loadConfig(env: Record<string, string | undefined>): Config {
  const hostPassword = env.HOST_PASSWORD;
  if (!hostPassword) throw new Error("HOST_PASSWORD is not set. Set it in the hosting dashboard before starting.");
  if (hostPassword.length < 8) throw new Error("HOST_PASSWORD must be at least 8 characters.");
  const port = env.PORT ? Number(env.PORT) : 3000;
  if (!Number.isInteger(port) || port < 0) throw new Error(`PORT is invalid: ${env.PORT}`);
  return { port, hostPassword, webDir: env.WEB_DIR ?? "dist/web" };
}
