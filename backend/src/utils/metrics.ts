// Prometheus metrics. Exposed at /metrics.
import client from "prom-client";

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status"],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.3, 0.5, 1, 3, 5],
  registers: [register],
});

export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status"],
  registers: [register],
});

export const bookingSuccess = new client.Counter({
  name: "booking_success_total",
  help: "Bookings successfully confirmed",
  registers: [register],
});

export const bookingConflict = new client.Counter({
  name: "booking_conflict_total",
  help: "Booking attempts that hit a conflict (inventory, room, policy)",
  registers: [register],
});

export const holdExpired = new client.Counter({
  name: "hold_expired_total",
  help: "Holds that expired without conversion",
  registers: [register],
});

export const adminAuthFailure = new client.Counter({
  name: "admin_auth_failure_total",
  help: "Admin login failures",
  registers: [register],
});

export const websocketConnections = new client.Gauge({
  name: "websocket_connections",
  help: "Number of active WebSocket connections",
  labelNames: ["namespace"],
  registers: [register],
});
