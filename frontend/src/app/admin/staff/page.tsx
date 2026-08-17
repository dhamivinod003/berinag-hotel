"use client";

import { useEffect, useState, useCallback } from "react";
import { Mail, Plus, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { adminListStaff, adminCreateStaff, adminUpdateStaff, ApiError } from "@/lib/api";
import type { StaffDto } from "@/lib/types";
import { useRealtimeEvents } from "@/lib/useRealtime";
import { cn } from "@/lib/cn";

export default function StaffPage() {
  const [items, setItems] = useState<StaffDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [submittingInvite, setSubmittingInvite] = useState(false);
  const [updatingStaffId, setUpdatingStaffId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const refresh = useCallback(async () => {
    try {
      const r = await adminListStaff();
      setItems(r.items);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to load staff");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useRealtimeEvents(
    useCallback(() => {
      // Refresh on realtime events if needed
    }, [])
  );

  async function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setInviteError(null);
    setSubmittingInvite(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      email: String(fd.get("email") || "").trim(),
      name: String(fd.get("name") || "").trim(),
      roleKey: String(fd.get("roleKey") || "RECEPTION"),
      password: String(fd.get("password") || ""),
    };
    if (payload.password.length < 8) {
      setInviteError("Password must be at least 8 characters.");
      setSubmittingInvite(false);
      return;
    }
    try {
      await adminCreateStaff(payload);
      setShowInvite(false);
      showToast("success", `Staff member ${payload.name} invited successfully.`);
      await refresh();
    } catch (err) {
      setInviteError(err instanceof ApiError ? err.message : "Failed to create staff");
    } finally {
      setSubmittingInvite(false);
    }
  }

  async function setStaffStatus(id: string, name: string, status: "ACTIVE" | "SUSPENDED" | "INACTIVE") {
    setUpdatingStaffId(id);
    try {
      await adminUpdateStaff(id, { status });
      setItems((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status } : s))
      );
      showToast(
        "success",
        `Staff member ${name} is now ${status === "ACTIVE" ? "activated" : "suspended"}.`
      );
      await refresh();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to update staff status";
      showToast("error", msg);
    } finally {
      setUpdatingStaffId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="font-display text-3xl text-ink">Staff</p>
          <p className="mt-1 text-sm text-ink-muted">Manage everyone with admin access to this resort.</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="pill bg-forest-800 text-white hover:bg-forest-700"
        >
          <Plus className="h-4 w-4" />
          Invite Staff
        </button>
      </div>

      {toast && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-2xl border p-4 text-sm transition-all shadow-soft",
            toast.type === "success"
              ? "border-forest-200 bg-forest-50 text-forest-800"
              : "border-red-200 bg-red-50 text-red-800"
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-forest-800" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-red-800" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {error && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-900">{error}</div>
      )}

      {showInvite && (
        <form
          onSubmit={handleInvite}
          className="rounded-3xl border border-border-soft bg-card p-5 shadow-soft lg:p-6"
        >
          <h2 className="mb-4 font-display text-xl text-ink">Invite a new staff member</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required><input required name="name" type="text" className="field" placeholder="Jane Doe" /></Field>
            <Field label="Email" required><input required name="email" type="email" className="field" placeholder="jane@resort.com" /></Field>
            <Field label="Role" required>
              <select required name="roleKey" className="field" defaultValue="RECEPTION">
                <option value="OWNER">Owner</option>
                <option value="MANAGER">Manager</option>
                <option value="RECEPTION">Reception</option>
                <option value="MARKETING">Marketing</option>
                <option value="HOUSEKEEPING">Housekeeping</option>
              </select>
            </Field>
            <Field label="Initial password" required>
              <input required name="password" type="password" className="field" placeholder="Min 8 chars" minLength={8} />
            </Field>
          </div>
          {inviteError && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" />
              {inviteError}
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={submittingInvite}
              className="pill bg-forest-800 text-white hover:bg-forest-700 disabled:opacity-50"
            >
              {submittingInvite ? "Sending..." : "Send Invite"}
            </button>
            <button
              type="button"
              onClick={() => { setShowInvite(false); setInviteError(null); }}
              className="pill border border-border-soft bg-card text-ink hover:bg-cream-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="skeleton h-96" />
      ) : (
        <div className="rounded-3xl border border-border-soft bg-card shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-soft text-left text-xs uppercase tracking-wider text-ink-muted">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Last login</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => {
                  const isUpdating = updatingStaffId === s.id;
                  return (
                    <tr key={s.id} className="border-b border-border-soft/60 last:border-0">
                      <td className="px-4 py-3 font-medium text-ink">{s.name}</td>
                      <td className="px-4 py-3 text-ink-muted">
                        <span className="inline-flex items-center gap-1.5">
                          <Mail className="h-3 w-3" />
                          {s.email}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-pill bg-forest-50 px-2.5 py-0.5 text-xs font-semibold text-forest-800">
                          {s.roleKey}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-muted">
                        {s.lastLoginAt
                          ? new Date(s.lastLoginAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                          : "Never"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "rounded-pill px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider",
                            s.status === "ACTIVE"
                              ? "bg-forest-50 text-forest-800"
                              : s.status === "SUSPENDED"
                              ? "bg-sun-50 text-sun-600"
                              : "bg-cream-100 text-ink-muted"
                          )}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isUpdating ? (
                          <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating...
                          </span>
                        ) : s.status === "ACTIVE" ? (
                          <button
                            onClick={() => setStaffStatus(s.id, s.name, "SUSPENDED")}
                            className="rounded-lg px-2.5 py-1 text-xs font-medium text-sun-600 hover:bg-sun-50"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => setStaffStatus(s.id, s.name, "ACTIVE")}
                            className="rounded-lg px-2.5 py-1 text-xs font-medium text-forest-800 hover:bg-forest-50"
                          >
                            Activate
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-muted">
        {label}
        {required && <span className="text-forest-800"> *</span>}
      </span>
      {children}
    </label>
  );
}
