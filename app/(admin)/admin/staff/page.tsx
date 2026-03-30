"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { type ApiEnvelope, type StaffRecord } from "@/lib/types";
import { useRealtime } from "@/hooks/use-realtime";

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/staff", { cache: "no-store" });
    const payload = (await res.json()) as ApiEnvelope<StaffRecord[]>;
    if (res.ok && payload.success) setStaff(payload.data);
  }, []);

  useEffect(() => {
    load();
    // Poll every 10 seconds for real-time presence updates
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, [load]);

  // Listen for real-time presence events
  useRealtime({
    role: "owner",
    onEvent: (event) => {
      if (event.type === "staff.presence.updated") {
        load();
      }
    }
  });

  async function createStaffUser() {
    setError("");
    setCreating(true);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const payload = (await res.json()) as { success: boolean; error?: { message: string } };
      if (!res.ok || !payload.success) {
        setError(payload.error?.message || "Failed to create designer");
        return;
      }
      setForm({ fullName: "", email: "", password: "" });
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(record: StaffRecord) {
    await fetch(`/api/admin/staff/${record.id}/activation`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: record.is_active !== 1 })
    });
    await load();
  }

  function presenceBadge(status: string | null) {
    if (status === "clocked_in") return <Badge className="bg-green-100 text-green-800">Online</Badge>;
    if (status === "break") return <Badge className="bg-yellow-100 text-yellow-800">Break</Badge>;
    return <Badge className="bg-neutral-100 text-neutral-500">Offline</Badge>;
  }

  const onlineCount = staff.filter((s) => s.last_presence_status === "clocked_in").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-semibold text-neutral-900">Designer Management</h1>
        <Badge className="bg-green-100 text-green-800 text-base px-4 py-1">
          {onlineCount} Online
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Designer Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}
          <div className="grid gap-3 md:grid-cols-4">
            <Input
              placeholder="Full name"
              value={form.fullName}
              onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
            />
            <Input
              type="email"
              placeholder="Designer email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            />
            <Input
              type="password"
              placeholder="Password (min 8 chars)"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            />
            <Button onClick={createStaffUser} disabled={creating || !form.fullName || !form.email || form.password.length < 8}>
              {creating ? "Creating..." : "Create Designer"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Designer Status</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[840px] text-sm">
            <thead>
              <tr className="text-neutral-500">
                <th className="px-2 py-3 text-left">Name</th>
                <th className="px-2 py-3 text-left">Email</th>
                <th className="px-2 py-3 text-left">Status</th>
                <th className="px-2 py-3 text-left">Last Seen</th>
                <th className="px-2 py-3 text-left">Account</th>
                <th className="px-2 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((record) => (
                <tr key={record.id} className="border-t border-neutral-200">
                  <td className="px-2 py-3 font-medium text-neutral-900">{record.full_name}</td>
                  <td className="px-2 py-3 text-neutral-600">{record.email}</td>
                  <td className="px-2 py-3">{presenceBadge(record.last_presence_status)}</td>
                  <td className="px-2 py-3 text-neutral-600">
                    {record.last_seen_at ? formatDate(record.last_seen_at) : "Never"}
                  </td>
                  <td className="px-2 py-3">
                    <Badge className={record.is_active === 1 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-600"}>
                      {record.is_active === 1 ? "Active" : "Disabled"}
                    </Badge>
                  </td>
                  <td className="px-2 py-3">
                    <Button size="sm" variant="outline" onClick={() => toggleActive(record)}>
                      {record.is_active === 1 ? "Deactivate" : "Activate"}
                    </Button>
                  </td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr><td colSpan={6} className="px-2 py-8 text-center text-neutral-500">No designers yet. Add one above.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
