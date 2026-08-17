import { WebSocketServer, type WebSocket } from "ws";
import type { IncomingMessage, Server as HttpServer } from "node:http";
import { verifyAccessToken } from "../services/tokenService.js";
import { eventBus, type ServerEvent } from "./events.js";
import { logger } from "../utils/logger.js";
import { websocketConnections } from "../utils/metrics.js";
import { prisma } from "../config/database.js";

interface AuthedSocket extends WebSocket {
  resortId: string;
  staffId: string;
  role: string;
}

let wss: WebSocketServer | null = null;

export function attachWebSocketServer(server: HttpServer): WebSocketServer {
  if (wss) return wss;
  wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (req, socket, head) => {
    if (!req.url) {
      socket.destroy();
      return;
    }
    // Expect /ws?token=... OR Authorization: Bearer <token> header.
    const url = new URL(req.url, "http://localhost");
    if (url.pathname !== "/ws") {
      socket.destroy();
      return;
    }
    const token = url.searchParams.get("token") || extractBearer(req.headers.authorization);
    if (!token) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    try {
      const payload = verifyAccessToken(token);

      // Verify staff account exists, is ACTIVE, and is not deleted
      const staff = await prisma.staff.findFirst({
        where: { id: payload.sub, resortId: payload.resortId, status: "ACTIVE", deletedAt: null },
      });
      if (!staff) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      wss!.handleUpgrade(req, socket, head, (ws) => {
        const authed = ws as AuthedSocket;
        authed.resortId = payload.resortId;
        authed.staffId = payload.sub;
        authed.role = staff.roleKey;
        wss!.emit("connection", authed, req);
      });
    } catch (err) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
    }
  });

  wss.on("connection", (ws: AuthedSocket) => {
    logger.info({ staffId: ws.staffId, resortId: ws.resortId }, "WS client connected");
    websocketConnections.inc({ namespace: "/admin" });

    // Send a hello
    safeSend(ws, { type: "HELLO", data: { resortId: ws.resortId, ts: Date.now() } });

    // Subscribe to this resort's event channel.
    const off = eventBus.onResort(ws.resortId, (event) => {
      const filtered = filterEventForRole(ws.role, event);
      safeSend(ws, filtered);
    });

    // Heartbeat — drop dead clients.
    let alive = true;
    ws.on("pong", () => { alive = true; });
    const heartbeat = setInterval(() => {
      if (!alive) {
        ws.terminate();
        clearInterval(heartbeat);
        return;
      }
      alive = false;
      try { ws.ping(); } catch { /* ignore */ }
    }, 30_000);

    ws.on("close", () => {
      clearInterval(heartbeat);
      off();
      websocketConnections.dec({ namespace: "/admin" });
      logger.info({ staffId: ws.staffId }, "WS client disconnected");
    });

    ws.on("error", (err) => {
      logger.warn({ err, staffId: ws.staffId }, "WS error");
    });
  });

  return wss;
}

function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function filterEventForRole(role: string, event: ServerEvent | { type: string; data: unknown }): any {
  if (role === "OWNER" || role === "MANAGER" || role === "RECEPTION") {
    return event;
  }

  // HOUSEKEEPING, MARKETING or low-privilege roles get sanitized event payloads
  const evt = JSON.parse(JSON.stringify(event));

  if (evt.type === "BOOKING_CREATED" || evt.type === "BOOKING_UPDATED") {
    if (evt.data?.reservation && typeof evt.data.reservation === "object") {
      const res = evt.data.reservation;
      delete res.guest;
      delete res.amountPaid;
      delete res.amountDue;
      delete res.totalAmount;
      delete res.subtotal;
      delete res.taxAmount;
      delete res.nightlyRate;
    }
  } else if (evt.type === "PAYMENT_CAPTURED") {
    if (evt.data && typeof evt.data === "object") {
      delete evt.data.amount;
    }
  } else if (evt.type === "ENQUIRY_CREATED") {
    if (evt.data?.enquiry && typeof evt.data.enquiry === "object") {
      const enq = evt.data.enquiry;
      delete enq.fullName;
      delete enq.email;
      delete enq.phone;
    }
  }

  return evt;
}

function safeSend(ws: WebSocket, event: ServerEvent | { type: string; data: unknown }): void {
  if (ws.readyState !== ws.OPEN) return;
  try {
    ws.send(JSON.stringify(event));
  } catch (err) {
    logger.warn({ err }, "WS send failed");
  }
}
