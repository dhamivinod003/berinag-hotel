// WebSocket client for live admin updates. Reconnects on disconnect.

import { getAccessToken } from "./api";

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let listeners: Set<(event: any) => void> = new Set();
let lastToken: string | null = null;

function getWsBase(): string {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
  return apiBase.replace(/^http/, "ws");
}

export function connectRealtime(): void {
  if (typeof window === "undefined") return;
  const token = getAccessToken();
  if (!token) return;
  if (socket && socket.readyState <= 1 && lastToken === token) return; // already connected
  lastToken = token;
  disconnectRealtime();

  const url = `${getWsBase()}/ws?token=${encodeURIComponent(token)}`;
  socket = new WebSocket(url);

  socket.addEventListener("open", () => {
    // connection is up; nothing to do, server will push events
  });

  socket.addEventListener("message", (e) => {
    let event: any;
    try {
      event = JSON.parse(e.data);
    } catch {
      return;
    }
    // Dispatch as DOM CustomEvent so non-React code (and devtools) can observe.
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(new CustomEvent("swr:event", { detail: event }));
      } catch {
        /* ignore */
      }
    }
    for (const fn of listeners) {
      try {
        fn(event);
      } catch {
        /* ignore */
      }
    }
  });

  socket.addEventListener("close", () => {
    socket = null;
    // Reconnect after 3s if we still have a token.
    if (getAccessToken() && !reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectRealtime();
      }, 3000);
    }
  });

  socket.addEventListener("error", () => {
    // The close handler will reconnect.
  });
}

export function disconnectRealtime(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket) {
    try { socket.close(); } catch { /* ignore */ }
    socket = null;
  }
  lastToken = null;
}

export function onRealtimeEvent(fn: (event: any) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
