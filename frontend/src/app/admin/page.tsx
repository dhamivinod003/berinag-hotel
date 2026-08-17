"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  UserPlus,
  LogIn,
  LogOut,
  BedDouble,
  IndianRupee,
  Plus,
  CalendarClock,
  Calendar,
  Tag,
  BarChart3,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
  Pie,
  PieChart,
} from "recharts";
import { adminDashboard, ApiError, type DashboardPayload } from "@/lib/api";
import { useRealtimeEvents } from "@/lib/useRealtime";
import { formatINR, formatDateShort } from "@/lib/format";

const KPIS = [
  { key: "bookings", label: "Total Bookings", icon: Calendar, color: "from-forest-100 to-forest-50", iconColor: "text-forest-800" },
  { key: "occupancy", label: "Occupancy today", icon: TrendingUp, color: "from-sky-100 to-sky-50", iconColor: "text-sky-600" },
  { key: "checkIns", label: "Check-ins", sub: "Today", icon: LogIn, color: "from-sun-100 to-sun-50", iconColor: "text-sun-500" },
  { key: "availableRooms", label: "Available Rooms", sub: "Today", icon: BedDouble, color: "from-wave-100 to-wave-50", iconColor: "text-wave-500" },
  { key: "revenue", label: "Booked today", icon: IndianRupee, color: "from-forest-100 to-forest-50", iconColor: "text-forest-800" },
] as const;

const QUICK_ACTIONS = [
  { label: "Add Booking", icon: Plus, href: "/admin/bookings/new" },
  { label: "View Bookings", icon: CalendarClock, href: "/admin/bookings" },
  { label: "Add Offer", icon: Tag, href: "/admin/offers" },
  { label: "View Reports", icon: BarChart3, href: "/admin/reports" },
];

const emptyDashboard: DashboardPayload = {
  occupancy: { total: 0, occupied: 0, percentage: 0 },
  availableRooms: { count: 0 },
  maintenanceRooms: { count: 0 },
  bookings: { total: 0, today: 0, pending: 0 },
  checkIns: { today: 0 },
  checkOuts: { today: 0 },
  pendingBookings: { count: 0 },
  pendingEnquiries: { count: 0 },
  cancelledToday: { count: 0 },
  revenue: { todayPaise: 0, collectedPaise: 0 },
  occupancyTrend: [],
  arrivals: [],
  departures: [],
  recentBookings: [],
  enquiries: [],
  housekeeping: { dirty: 0, cleaning: 0, ready: 0, occupied: 0, maintenance: 0, outOfOrder: 0 },
};

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentEvent, setRecentEvent] = useState<string | null>(null);

  const refresh = useCallback(() => {
    adminDashboard()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((err) => {
        if (err instanceof ApiError) setError(err.message);
        else setError("Failed to load dashboard");
      });
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, [refresh]);

  useRealtimeEvents(
    useCallback(
      (event) => {
        if (!event?.type) return;
        const interesting = [
          "BOOKING_CREATED",
          "BOOKING_UPDATED",
          "BOOKING_CANCELLED",
          "BOOKING_CHECKED_IN",
          "BOOKING_CHECKED_OUT",
          "BOOKING_EXTENDED",
          "PAYMENT_CAPTURED",
          "ROOM_STATUS_CHANGED",
          "ROOM_ASSIGNED",
          "ROOM_MOVED",
          "ENQUIRY_CREATED",
        ];
        if (interesting.includes(event.type)) {
          setRecentEvent(event.type);
          setTimeout(() => setRecentEvent(null), 4000);
          refresh();
        }
      },
      [refresh]
    )
  );

  if (error && !data) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-900">
        <p className="font-semibold">Couldn't load dashboard</p>
        <p className="mt-1 text-sm">{error}</p>
      </div>
    );
  }

  const d = data ?? emptyDashboard;
  const kpiValues: Record<string, string> = {
    bookings: String(d.bookings.total),
    occupancy: `${d.occupancy.percentage}%`,
    checkIns: String(d.checkIns.today),
    availableRooms: String(d.availableRooms.count),
    revenue: formatINR(d.revenue.todayPaise),
  };

  const rooms = [
    { name: "Occupied", value: d.occupancy.occupied, color: "#2D5F3F" },
    { name: "Available", value: d.availableRooms.count, color: "#0EA5E9" },
    { name: "Maintenance", value: d.maintenanceRooms.count, color: "#E8895C" },
  ];
  const totalRooms = d.occupancy.total;

  const hk = [
    { label: "Dirty", value: d.housekeeping.dirty, color: "bg-red-50 text-red-700" },
    { label: "Cleaning", value: d.housekeeping.cleaning, color: "bg-sun-50 text-sun-600" },
    { label: "Ready", value: d.housekeeping.ready, color: "bg-forest-50 text-forest-800" },
    { label: "Out of Order", value: d.housekeeping.outOfOrder, color: "bg-cream-100 text-ink-muted" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-display text-3xl text-ink">Welcome back</p>
          <p className="mt-1 text-sm text-ink-muted">
            Counts start at zero. Every booking on this site updates these numbers live.
          </p>
        </div>
        {recentEvent && (
          <span className="inline-flex items-center rounded-pill bg-forest-50 px-3 py-1 text-xs font-semibold text-forest-800">
            Live update · {recentEvent.replace(/_/g, " ")}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {KPIS.map((k, i) => (
          <motion.div
            key={k.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            className="rounded-3xl border border-border-soft bg-card p-4 shadow-soft sm:p-5"
          >
            <div className="flex items-start justify-between">
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${k.color}`}>
                <k.icon className={`h-5 w-5 ${k.iconColor}`} strokeWidth={1.75} />
              </div>
              {k.key === "bookings" && d.bookings.today > 0 && (
                <span className="inline-flex items-center rounded-pill bg-forest-50 px-2 py-0.5 text-xs font-semibold text-forest-800">
                  +{d.bookings.today} today
                </span>
              )}
            </div>
            <div className="mt-4">
              <p className="text-2xl font-semibold text-ink sm:text-3xl">{kpiValues[k.key]}</p>
              <p className="mt-0.5 text-xs text-ink-muted sm:text-sm">
                {("sub" in k && k.sub) || k.label}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="rounded-3xl border border-border-soft bg-card p-5 shadow-soft lg:col-span-2 lg:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl text-ink">Occupancy this week</h2>
              <p className="mt-0.5 text-xs text-ink-muted">Rooms booked for each day, starting today</p>
            </div>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.occupancyTrend}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2D5F3F" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#2D5F3F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#6B6B6B", fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6B6B6B", fontSize: 12 }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: "#0F1F17", border: "none", borderRadius: 12, color: "#fff", fontSize: 12 }}
                  cursor={{ stroke: "#2D5F3F", strokeWidth: 1, strokeDasharray: 3 }}
                  formatter={(value: number, _name, item) => {
                    const row = item?.payload as { occupied?: number; total?: number } | undefined;
                    return [`${value}% (${row?.occupied ?? 0}/${row?.total ?? 0} rooms)`, "Occupancy"];
                  }}
                />
                <Area type="monotone" dataKey="value" stroke="#2D5F3F" strokeWidth={2.5} fill="url(#g)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-border-soft bg-card p-5 shadow-soft lg:p-6">
          <h2 className="font-display text-xl text-ink">Room Status</h2>
          <div className="mt-4 flex items-center justify-center">
            <div className="relative h-44 w-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={rooms} innerRadius={50} outerRadius={75} paddingAngle={2} dataKey="value" stroke="none">
                    {rooms.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-3xl font-semibold text-ink">{totalRooms}</p>
                <p className="text-xs text-ink-muted">Total Rooms</p>
              </div>
            </div>
          </div>
          <ul className="mt-6 space-y-2 text-sm">
            {rooms.map((r) => (
              <li key={r.name} className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-ink">
                  <span className="h-2 w-2 rounded-pill" style={{ background: r.color }} />
                  {r.name}
                </span>
                <span className="font-semibold text-ink">{r.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <Card title="Today's Arrivals" rightAction="View All" href="/admin/bookings">
          {d.arrivals.length === 0 ? (
            <EmptyState text="No arrivals today. Bookings that check in today will show up here." />
          ) : (
            <ul className="divide-y divide-border-soft">
              {d.arrivals.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <Avatar name={a.guestName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{a.guestName}</p>
                    <p className="text-xs text-ink-muted">
                      {a.roomType}
                      {a.roomNumber ? ` · ${a.roomNumber}` : ""}
                    </p>
                  </div>
                  <div className="text-right text-xs text-ink-muted">
                    <p>{a.guests || a.rooms} guests</p>
                    <p className="font-medium text-ink">{a.time || "—"}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Today's Departures" rightAction="View All" href="/admin/bookings">
          {d.departures.length === 0 ? (
            <EmptyState text="No departures today." />
          ) : (
            <ul className="divide-y divide-border-soft">
              {d.departures.map((dep) => (
                <li key={dep.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <Avatar name={dep.guestName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{dep.guestName}</p>
                    <p className="text-xs text-ink-muted">
                      {dep.roomType}
                      {dep.roomNumber ? ` · ${dep.roomNumber}` : ""}
                    </p>
                  </div>
                  <div className="text-right text-xs text-ink-muted">
                    <p>{dep.guests || dep.rooms} guests</p>
                    <p className="font-medium text-ink">{dep.time || "11:00"}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <Card title="Recent Bookings" rightAction="View All" href="/admin/bookings">
          {d.recentBookings.length === 0 ? (
            <EmptyState text="No bookings yet. When a guest books a room on this site, it will be counted here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-ink-muted">
                    <th className="pb-2 font-medium">ID</th>
                    <th className="pb-2 font-medium">Guest</th>
                    <th className="pb-2 font-medium">Room</th>
                    <th className="pb-2 font-medium">Dates</th>
                    <th className="pb-2 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recentBookings.map((b) => (
                    <tr key={b.id} className="border-t border-border-soft">
                      <td className="py-3 font-mono text-xs text-ink-muted">
                        <Link href={`/admin/bookings/${b.id}`} className="hover:underline">
                          #{b.bookingReference}
                        </Link>
                      </td>
                      <td className="py-3 font-medium text-ink">{b.guestName}</td>
                      <td className="py-3 text-ink-muted">
                        {b.roomType}
                        {b.rooms > 1 ? ` ×${b.rooms}` : ""}
                      </td>
                      <td className="py-3 text-ink-muted">
                        {formatDateShort(b.checkIn)} – {formatDateShort(b.checkOut)}
                      </td>
                      <td className="py-3 text-right">
                        <StatusPill status={b.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Pending Enquiries" rightAction="View All" href="/admin/enquiries">
          {d.enquiries.length === 0 ? (
            <EmptyState text="No pending enquiries." />
          ) : (
            <ul className="divide-y divide-border-soft">
              {d.enquiries.map((e) => (
                <li key={e.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-forest-50 text-forest-800">
                    <UserPlus className="h-4 w-4" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{e.name}</p>
                    <p className="text-xs text-ink-muted">{e.detail}</p>
                  </div>
                  <span className="text-xs text-ink-muted">{e.time}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <Card title="Quick Actions">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {QUICK_ACTIONS.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="group flex flex-col items-center gap-2 rounded-2xl border border-border-soft bg-card px-3 py-4 transition-colors hover:border-forest-800/30 hover:bg-forest-50"
              >
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-cream-100 text-forest-800 transition-colors group-hover:bg-forest-800 group-hover:text-white">
                  <a.icon className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <span className="text-center text-xs font-medium text-ink">{a.label}</span>
              </Link>
            ))}
          </div>
        </Card>

        <Card title="Housekeeping Overview" rightAction="View All" href="/admin/housekeeping">
          <div className="grid grid-cols-4 gap-3">
            {hk.map((h) => (
              <div key={h.label} className={`rounded-2xl p-4 text-center ${h.color}`}>
                <p className="font-display text-3xl font-semibold">{h.value}</p>
                <p className="mt-1 text-xs font-medium">{h.label}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Card({
  title,
  rightAction,
  children,
  href,
}: {
  title: string;
  rightAction?: string;
  children: React.ReactNode;
  href?: string;
}) {
  return (
    <div className="rounded-3xl border border-border-soft bg-card p-5 shadow-soft lg:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl text-ink">{title}</h2>
        {rightAction && (
          <Link href={href ?? "/admin"} className="text-sm font-medium text-forest-800 hover:underline">
            {rightAction}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-ink-muted">{text}</p>;
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-forest-50 text-sm font-medium text-forest-800">
      {name[0]}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    CONFIRMED: "bg-forest-50 text-forest-800",
    PENDING: "bg-sun-50 text-sun-600",
    CANCELLED: "bg-red-50 text-red-700",
    CHECKED_IN: "bg-violet-50 text-violet-700",
    CHECKED_OUT: "bg-cream-100 text-ink-muted",
  };
  return (
    <span className={`inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-semibold ${map[status] ?? "bg-cream-100 text-ink-muted"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
