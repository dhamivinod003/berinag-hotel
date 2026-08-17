"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  CalendarDays,
  Users,
  BedDouble,
  Inbox,
  Activity,
  Download,
  Filter,
  Loader2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  adminReportDashboard,
  ApiError,
  type ReportBundle,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { formatINR } from "@/lib/format";

type Range = "7" | "30" | "90" | "365";

function todayMinus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function rangeFor(preset: Range): { from: string; to: string } {
  return { from: todayMinus(parseInt(preset, 10)), to: new Date().toISOString().slice(0, 10) };
}

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: "#2D5F3F",
  CHECKED_IN: "#E8895C",
  CHECKED_OUT: "#6B6B6B",
  CANCELLED: "#9A9A95",
  NO_SHOW: "#B85B3A",
  PENDING: "#0284C7",
  EXPIRED: "#0F1F17",
  HELD: "#38BDF8",
};

export default function ReportsPage() {
  const [preset, setPreset] = useState<Range>("30");
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);
  const [data, setData] = useState<ReportBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => custom ?? rangeFor(preset), [custom, preset]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await adminReportDashboard(range.from, range.to);
      setData(r);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    load();
  }, [load]);

  function downloadCSV() {
    if (!data) return;
    const rows: string[] = [];
    rows.push("Section,Metric,Value");
    rows.push(`Occupancy,Average %,${data.occupancy.averagePct}`);
    data.occupancy.byDay.forEach((d) => rows.push(`Occupancy,${d.date},${d.occupancyPct}`));
    rows.push(`Revenue,Total INR,${data.revenue.totalRevenue / 100}`);
    rows.push(`Revenue,Collected INR,${data.revenue.collected / 100}`);
    rows.push(`Revenue,Outstanding INR,${data.revenue.outstanding / 100}`);
    rows.push(`Revenue,Refunded INR,${data.revenue.refunded / 100}`);
    rows.push(`Bookings,Total,${data.bookings.total}`);
    Object.entries(data.bookings.byStatus).forEach(([s, n]) => rows.push(`Bookings,${s},${n}`));
    data.roomPerformance.forEach((r) => rows.push(`Room,${r.roomTypeName},${r.revenue / 100}`));
    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${range.from}-to-${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-3xl text-ink">Reports &amp; Analytics</p>
          <p className="mt-1 text-sm text-ink-muted">
            All metrics calculated from your live booking, payment, and occupancy data.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={downloadCSV} disabled={!data} className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Range filter */}
      <GlassPanel className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-ink-muted" />
          <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">Range</span>
          {(["7", "30", "90", "365"] as Range[]).map((p) => (
            <button
              key={p}
              onClick={() => { setPreset(p); setCustom(null); }}
              className={`rounded-pill px-3 py-1.5 text-sm transition-colors ${
                preset === p && !custom
                  ? "bg-forest-800 text-white"
                  : "border border-border-soft bg-card text-ink hover:border-forest-800/40"
              }`}
            >
              Last {p}d
            </button>
          ))}
          <span className="text-ink-muted">·</span>
          <span className="text-xs text-ink-muted">Custom:</span>
          <input
            type="date"
            className="rounded-xl border border-border-soft bg-card px-2 py-1 text-sm"
            value={custom?.from ?? ""}
            onChange={(e) => setCustom({ from: e.target.value, to: custom?.to ?? "" })}
          />
          <span className="text-ink-muted">→</span>
          <input
            type="date"
            className="rounded-xl border border-border-soft bg-card px-2 py-1 text-sm"
            value={custom?.to ?? ""}
            onChange={(e) => setCustom({ from: custom?.from ?? "", to: e.target.value })}
          />
        </div>
      </GlassPanel>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</div>
      )}

      {loading || !data ? (
        <div className="space-y-4">
          <div className="skeleton h-24" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-28" />
            ))}
          </div>
          <div className="skeleton h-64" />
        </div>
      ) : (
        <>
          <KpiRow data={data} />
          <div className="grid gap-4 lg:grid-cols-3">
            <OccupancyChart data={data} />
            <RevenueChart data={data} />
            <BookingStatusDonut data={data} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <RevenueBySourceChart data={data} />
            <RevenueByRoomTypeChart data={data} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <RoomPerformanceTable data={data} />
            <EnquiryFunnelCard data={data} />
          </div>
        </>
      )}
    </div>
  );
}

function KpiRow({ data }: { data: ReportBundle }) {
  const r = data.revenue;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi
        icon={IndianRupee}
        label="Revenue (collected)"
        value={formatINR(r.collected)}
        sub={`Outstanding ${formatINR(r.outstanding)}`}
      />
      <Kpi
        icon={CalendarDays}
        label="Avg occupancy"
        value={`${data.occupancy.averagePct}%`}
        sub={`${data.occupancy.byDay.length} days`}
      />
      <Kpi
        icon={Users}
        label="Total bookings"
        value={String(data.bookings.total)}
        sub={`Avg stay ${data.bookings.averageStayNights} nights`}
      />
      <Kpi
        icon={Inbox}
        label="Enquiry conversion"
        value={`${data.enquiries.conversionRatePct}%`}
        sub={`${data.enquiries.total} enquiries`}
      />
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <GlassPanel className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">{label}</p>
        <div className="rounded-pill bg-forest-50 p-2 text-forest-800">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 font-mono text-2xl font-semibold text-ink">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-muted">{sub}</p>}
    </GlassPanel>
  );
}

function OccupancyChart({ data }: { data: ReportBundle }) {
  const points = data.occupancy.byDay.map((d) => ({
    date: d.date.slice(5), // MM-DD
    occupancy: d.occupancyPct,
    rooms: d.occupiedRoomNights,
  }));
  return (
    <Panel title="Occupancy" icon={Activity} subtitle="% of rooms occupied each day">
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={points} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="occGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2D5F3F" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#2D5F3F" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E8E6E0" />
          <XAxis dataKey="date" stroke="#9A9A95" fontSize={11} />
          <YAxis stroke="#9A9A95" fontSize={11} unit="%" />
          <Tooltip
            contentStyle={{
              background: "rgba(255,255,255,0.95)",
              border: "1px solid #E8E6E0",
              borderRadius: 12,
              backdropFilter: "blur(12px)",
            }}
            formatter={(v: number) => `${v}%`}
          />
          <Area type="monotone" dataKey="occupancy" stroke="#2D5F3F" strokeWidth={2.5} fill="url(#occGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </Panel>
  );
}

function RevenueChart({ data }: { data: ReportBundle }) {
  const points = data.revenue.byDate.map((d) => ({
    date: d.date.slice(5),
    revenue: d.revenue / 100,
    count: d.count,
  }));
  return (
    <Panel title="Revenue by check-in day" icon={TrendingUp} subtitle="Total invoice value (₹)">
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={points} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E8895C" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#E8895C" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E8E6E0" />
          <XAxis dataKey="date" stroke="#9A9A95" fontSize={11} />
          <YAxis stroke="#9A9A95" fontSize={11} />
          <Tooltip
            contentStyle={{
              background: "rgba(255,255,255,0.95)",
              border: "1px solid #E8E6E0",
              borderRadius: 12,
              backdropFilter: "blur(12px)",
            }}
            formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`}
          />
          <Area type="monotone" dataKey="revenue" stroke="#E8895C" strokeWidth={2.5} fill="url(#revGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </Panel>
  );
}

function BookingStatusDonut({ data }: { data: ReportBundle }) {
  const entries = Object.entries(data.bookings.byStatus)
    .filter(([, n]) => n > 0)
    .map(([status, count]) => ({ status, count }));
  return (
    <Panel title="Booking status" icon={CalendarDays} subtitle="Distribution by status">
      {entries.length === 0 ? (
        <div className="flex h-[220px] items-center justify-center text-sm text-ink-muted">
          No bookings in this range
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={entries}
              dataKey="count"
              nameKey="status"
              innerRadius={45}
              outerRadius={75}
              paddingAngle={2}
            >
              {entries.map((e) => (
                <Cell key={e.status} fill={STATUS_COLORS[e.status] ?? "#6B6B6B"} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "rgba(255,255,255,0.95)",
                border: "1px solid #E8E6E0",
                borderRadius: 12,
                backdropFilter: "blur(12px)",
              }}
            />
            <Legend
              verticalAlign="bottom"
              iconSize={10}
              wrapperStyle={{ fontSize: 11, color: "#6B6B6B" }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </Panel>
  );
}

function RevenueBySourceChart({ data }: { data: ReportBundle }) {
  const points = data.revenue.bySource.map((s) => ({
    source: s.source,
    revenue: s.revenue / 100,
    count: s.count,
  }));
  return (
    <Panel title="Revenue by source" icon={Inbox} subtitle="Where bookings come from">
      {points.length === 0 ? (
        <div className="flex h-[260px] items-center justify-center text-sm text-ink-muted">
          No data
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={points} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E6E0" vertical={false} />
            <XAxis dataKey="source" stroke="#9A9A95" fontSize={11} />
            <YAxis stroke="#9A9A95" fontSize={11} />
            <Tooltip
              contentStyle={{
                background: "rgba(255,255,255,0.95)",
                border: "1px solid #E8E6E0",
                borderRadius: 12,
                backdropFilter: "blur(12px)",
              }}
              formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`}
            />
            <Bar dataKey="revenue" fill="#2D5F3F" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Panel>
  );
}

function RevenueByRoomTypeChart({ data }: { data: ReportBundle }) {
  const points = data.revenue.byRoomType.map((r) => ({
    name: r.roomTypeName,
    revenue: r.revenue / 100,
  }));
  return (
    <Panel title="Revenue by room type" icon={BedDouble} subtitle="Which rooms earn the most">
      {points.length === 0 ? (
        <div className="flex h-[260px] items-center justify-center text-sm text-ink-muted">
          No data
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={points} layout="vertical" margin={{ top: 10, right: 20, left: 40, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E6E0" horizontal={false} />
            <XAxis type="number" stroke="#9A9A95" fontSize={11} />
            <YAxis dataKey="name" type="category" stroke="#9A9A95" fontSize={11} width={120} />
            <Tooltip
              contentStyle={{
                background: "rgba(255,255,255,0.95)",
                border: "1px solid #E8E6E0",
                borderRadius: 12,
                backdropFilter: "blur(12px)",
              }}
              formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`}
            />
            <Bar dataKey="revenue" fill="#E8895C" radius={[0, 8, 8, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Panel>
  );
}

function RoomPerformanceTable({ data }: { data: ReportBundle }) {
  const rows = data.roomPerformance;
  return (
    <Panel title="Room performance" icon={BedDouble} subtitle="Bookings, revenue, and average value">
      {rows.length === 0 ? (
        <div className="flex h-[200px] items-center justify-center text-sm text-ink-muted">No data</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border-soft">
          <table className="w-full text-sm">
            <thead className="bg-cream-50 text-xs font-medium uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="px-4 py-3 text-left">Room type</th>
                <th className="px-4 py-3 text-right">Bookings</th>
                <th className="px-4 py-3 text-right">Revenue</th>
                <th className="px-4 py-3 text-right">Avg value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.roomTypeId} className="border-t border-border-soft">
                  <td className="px-4 py-3 font-medium text-ink">{r.roomTypeName}</td>
                  <td className="px-4 py-3 text-right font-mono">{r.bookings}</td>
                  <td className="px-4 py-3 text-right font-mono text-forest-800">
                    {formatINR(r.revenue)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-ink-muted">
                    {formatINR(r.avgValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function EnquiryFunnelCard({ data }: { data: ReportBundle }) {
  const { byStatus, total, conversionRatePct, contactRatePct } = data.enquiries;
  const order: Array<keyof typeof byStatus> = ["NEW", "CONTACTED", "CONVERTED", "LOST"];
  return (
    <Panel title="Enquiry funnel" icon={Inbox} subtitle="From contact to booking">
      {total === 0 ? (
        <div className="flex h-[200px] items-center justify-center text-sm text-ink-muted">
          No enquiries in this range
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-ink-muted">Total</p>
              <p className="font-mono text-xl font-semibold">{total}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Contact rate</p>
              <p className="font-mono text-xl font-semibold">{contactRatePct}%</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Conversion</p>
              <p className="font-mono text-xl font-semibold text-forest-800">{conversionRatePct}%</p>
            </div>
          </div>
          <div className="space-y-2">
            {order.map((s) => {
              const n = byStatus[s] ?? 0;
              const pct = total > 0 ? Math.round((n / total) * 100) : 0;
              return (
                <div key={s}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">{s}</span>
                    <span className="text-ink-muted">
                      {n} · {pct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-cream-100">
                    <div
                      className="h-full rounded-full bg-forest-800 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Panel>
  );
}

function Panel({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <GlassPanel className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="rounded-pill bg-forest-50 p-1.5 text-forest-800">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div>
          <p className="font-display text-lg text-ink">{title}</p>
          {subtitle && <p className="text-xs text-ink-muted">{subtitle}</p>}
        </div>
      </div>
      {children}
    </GlassPanel>
  );
}
