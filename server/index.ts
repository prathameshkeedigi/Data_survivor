import { loadConfig } from "./config";
import { startServer } from "./server";

const config = loadConfig(process.env);
const srv = await startServer(config);
console.log(`DATA SURVIVOR listening on :${srv.port}`);

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    console.log(`${sig} received, shutting down`);
    srv.close().then(() => process.exit(0));
  });
}
