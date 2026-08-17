import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { expireDueHolds } from "../services/reservationHoldService.js";
import { expirePendingPaymentReservations } from "../services/expirationService.js";

let timer: NodeJS.Timeout | null = null;

export function startHoldExpiryWorker(): void {
  if (timer) return;
  const intervalMs = env.HOLD_EXPIRY_CHECK_INTERVAL_SEC * 1000;
  logger.info({ intervalMs }, "Starting hold & pending-payment expiry worker");
  // Run once immediately, then on interval.
  void expireDueHolds();
  void expirePendingPaymentReservations();
  timer = setInterval(() => {
    void expireDueHolds().catch((err) =>
      logger.error({ err }, "Hold-expiry sweep failed")
    );
    void expirePendingPaymentReservations().catch((err) =>
      logger.error({ err }, "Pending payment-expiry sweep failed")
    );
  }, intervalMs);
}

export function stopHoldExpiryWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
