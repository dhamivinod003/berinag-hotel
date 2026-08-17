import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { attachWebSocketServer } from "./realtime/websocketServer.js";

const app = createApp();
const port = env.PORT;

if (port === 0) {
  // Don't auto-listen when port is 0 — that's the test harness signal.
  logger.warn("PORT=0 detected; not auto-listen. Caller must listen.");
} else {
  const server = app.listen(port, () => {
    logger.info({ port, env: env.NODE_ENV }, "Sun & Water Resort API listening");
  });
  // Attach the WebSocket server for realtime events.
  attachWebSocketServer(server);

  const shutdown = (signal: string) => {
    logger.info({ signal }, "Shutting down");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "Unhandled promise rejection");
  });
}
