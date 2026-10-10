import { createServer } from "node:http";
import { loadConfig } from "./config";
import { createHttpApp } from "./app";

const config = loadConfig(process.env);
const app = createHttpApp(config);
const httpServer = createServer(app);

httpServer.listen(config.port, () => {
  console.log(`DATA SURVIVOR listening on :${config.port}`);
});
