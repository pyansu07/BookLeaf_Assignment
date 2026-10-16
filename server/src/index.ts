import { createServer } from "http";
import { createApp } from "./app";
import { initRealtime } from "./realtime";
import { env } from "./config/env";

const app = createApp();
const httpServer = createServer(app);
initRealtime(httpServer);

httpServer.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`BookLeaf API listening on port ${env.port}`);
});
