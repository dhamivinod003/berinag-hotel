"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Check,
  CheckCheck,
  X,
  IndianRupee,
  Calendar,
  CreditCard,
  Wrench,
  MessageSquare,
  AlertCircle,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  adminListNotifications,
  adminUnreadCount,
  adminMarkNotificationRead,
  adminMarkAllRead,
  adminDeleteNotification,
  type NotificationDto,
} from "@/lib/api";

const TYPE_ICON: Record<string, typeof IndianRupee> = {
  BOOKING_CREATED: Calendar,
  BOOKING_CANCELLED: X,
  BOOKING_MODIFIED: Calendar,
  ROOM_ASSIGNED: Check,
  ROOM_MOVED: Calendar,
  PAYMENT_RECEIVED: IndianRupee,
  PAYMENT_FAILED: CreditCard,
  ENQUIRY_NEW: MessageSquare,
  HOUSEKEEPING_TASK: Sparkles,
  MAINTENANCE_ISSUE: Wrench,
};

const TYPE_TINT: Record<string, string> = {
  BOOKING_CREATED: "bg-emerald-50 text-emerald-700",
  BOOKING_CANCELLED: "bg-red-50 text-red-700",
  PAYMENT_RECEIVED: "bg-emerald-50 text-emerald-700",
  PAYMENT_FAILED: "bg-red-50 text-red-700",
  ENQUIRY_NEW: "bg-blue-50 text-blue-700",
};

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [count, list] = await Promise.all([
        adminUnreadCount(),
        adminListNotifications(),
      ]);
      setUnread(count.count);
      setItems(list.items);
      setTotal(list.total);
    } catch {
      // Silently fail — notifications are non-critical
    }
  }, []);

  // Poll every 30s + on visibility change
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // Listen for realtime events (already in place via connectRealtime)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { type?: string };
      if (detail?.type && detail.type.startsWith("NOTIFICATION_")) {
        refresh();
      }
    };
    window.addEventListener("swr:event", handler as EventListener);
    return () => window.removeEventListener("swr:event", handler as EventListener);
  }, [refresh]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const handleMarkRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await adminMarkNotificationRead(id);
      await refresh();
    } catch {}
  };

  const handleMarkAll = async () => {
    try {
      await adminMarkAllRead();
      await refresh();
    } catch {}
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await adminDeleteNotification(id);
      await refresh();
    } catch {}
  };

  const handleClick = async (n: NotificationDto) => {
    if (!n.readAt) await handleMarkRead(n.id, { stopPropagation: () => {} } as React.MouseEvent);
    if (n.link) {
      router.push(n.link);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) refresh();
        }}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-pill border border-border-soft bg-card hover:bg-cream-50"
        aria-label={`Notifications, ${unread} unread`}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-50 mt-2 w-[380px] overflow-hidden rounded-3xl border border-border-soft bg-card shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border-soft p-4">
              <div>
                <h3 className="font-display text-base text-ink">Notifications</h3>
                <p className="text-xs text-ink-muted">
                  {unread > 0 ? `${unread} unread` : "All caught up"}
                </p>
              </div>
              {unread > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-forest hover:bg-forest/10"
                >
                  <CheckCheck className="h-3 w-3" />
                  Mark all
                </button>
              )}
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-ink-muted">
                  <Bell className="h-6 w-6 opacity-40" />
                  No notifications yet
                </div>
              ) : (
                items.map((n) => {
                  const Icon = TYPE_ICON[n.type] ?? AlertCircle;
                  const tint = TYPE_TINT[n.type] ?? "bg-slate-50 text-slate-700";
                  return (
                    <div
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className={`group flex cursor-pointer gap-3 border-b border-border-soft/60 p-3 transition hover:bg-cream-50 ${
                        !n.readAt ? "bg-forest/[0.03]" : ""
                      }`}
                    >
                      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${tint}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-sm font-medium text-ink">
                          {n.title}
                          {!n.readAt && (
                            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-forest" />
                          )}
                        </p>
                        {n.body && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{n.body}</p>
                        )}
                        <p className="mt-1 text-xs text-ink-muted">
                          {timeAgo(n.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 items-start gap-1 opacity-0 transition group-hover:opacity-100">
                        {!n.readAt && (
                          <button
                            onClick={(e) => handleMarkRead(n.id, e)}
                            className="rounded-full p-1 hover:bg-emerald-100 hover:text-emerald-700"
                            title="Mark as read"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDelete(n.id, e)}
                          className="rounded-full p-1 hover:bg-red-100 hover:text-red-700"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
