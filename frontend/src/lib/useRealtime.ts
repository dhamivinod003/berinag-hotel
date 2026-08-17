"use client";

import { useEffect } from "react";
import { connectRealtime, disconnectRealtime, onRealtimeEvent } from "@/lib/realtime";

/**
 * Subscribe to live admin events. Pass a handler; the hook manages
 * (dis)connection on mount/unmount.
 */
export function useRealtimeEvents(handler: (event: any) => void): void {
  useEffect(() => {
    connectRealtime();
    const off = onRealtimeEvent(handler);
    return () => {
      off();
      // Don't disconnect here — the admin app likely has many components
      // subscribed. The connection auto-closes on logout.
    };
  }, [handler]);
}
