// Standalone worker entrypoint. Run with `npm run worker`.
// Currently runs the hold-expiry sweeper; add BullMQ workers here as
// you wire them in (email, WhatsApp, webhooks, report exports).

import { startHoldExpiryWorker } from "./jobs/holdExpiry.js";
import { logger } from "./utils/logger.js";

logger.info("Starting standalone worker");
startHoldExpiryWorker();

function shutdown(signal: string) {
  logger.info({ signal }, "Worker shutting down");
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
