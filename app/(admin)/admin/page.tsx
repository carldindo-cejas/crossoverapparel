"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/admin/kpi-card";
import { SalesChart } from "@/components/admin/sales-chart";
import { useRealtime } from "@/hooks/use-realtime";
import { useApi } from "@/hooks/use-api";
import { formatCurrency } from "@/lib/format";
import { type DashboardSummary } from "@/lib/types";
import { type ApiEnvelope } from "@/lib/types";

type PaymentMethod = {
  id: number;
  name: string;
  is_available: number;
};

type DesignerCommission = {
  id: string;
  full_name: string;
  total_players: number;
  total_commission_cents: number;
};

export default function AdminDashboardPage() {
  const [refreshTick, setRefreshTick] = useState(0);
  const { data, loading, error } = useApi<DashboardSummary>(`/api/admin/dashboard?tick=${refreshTick}`);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [commissions, setCommissions] = useState<DesignerCommission[]>([]);
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; time: Date }>>([]);

  useRealtime({
    role: "owner",
    onEvent: (event) => {
      if (event.type === "dashboard.updated" || event.type === "order.status.updated") {
        setRefreshTick((current) => current + 1);
      }
      if (event.type === "order.created") {
        const orderNum = (event.payload?.orderNumber as string) || "new";
        setNotifications((prev) => [
          { id: crypto.randomUUID(), message: `New order received: ${orderNum}`, time: new Date() },
          ...prev.slice(0, 49),
        ]);
        setRefreshTick((current) => current + 1);
      }
      if (event.type === "order.status.updated" && event.payload?.changedByRole === "designer") {
        const orderNum = (event.payload?.orderNumber as string) || "";
        const newStatus = (event.payload?.newStatus as string) || "";
        setNotifications((prev) => [
          { id: crypto.randomUUID(), message: `Designer updated order ${orderNum} to ${newStatus.replace(/_/g, " ")}`, time: new Date() },
          ...prev.slice(0, 49),
        ]);
      }
      if (event.type === "staff.presence.updated") {
        const state = event.payload?.state as string;
        const designerName = (event.payload?.fullName as string) || "Designer";
        setNotifications((prev) => [
          { id: crypto.randomUUID(), message: `${designerName} ${state === "online" ? "logged in" : state === "offline" ? "logged out" : "is on break"}`, time: new Date() },
          ...prev.slice(0, 49),
        ]);
      }
    }
  });

  useEffect(() => {
    async function loadPaymentMethods() {
      const res = await fetch("/api/admin/payment-methods", { cache: "no-store" });
      const payload = (await res.json()) as ApiEnvelope<PaymentMethod[]>;
      if (res.ok && payload.success) setPaymentMethods(payload.data);
    }
    async function loadCommissions() {
      const res = await fetch("/api/admin/commissions", { cache: "no-store" });
      const payload = (await res.json()) as ApiEnvelope<DesignerCommission[]>;
      if (res.ok && payload.success) setCommissions(payload.data);
    }
    loadPaymentMethods();
    loadCommissions();
  }, [refreshTick]);

  async function togglePaymentMethod(pm: PaymentMethod) {
    await fetch("/api/admin/payment-methods", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pm.id, isAvailable: pm.is_available !== 1 }),
    });
    setPaymentMethods((prev) =>
      prev.map((m) => (m.id === pm.id ? { ...m, is_available: m.is_available === 1 ? 0 : 1 } : m))
    );
  }

  const bestSellers = useMemo(() => data?.bestSellingProducts || [], [data]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-semibold text-neutral-900">Owner Dashboard</h1>
          <p className="mt-2 text-neutral-600">Sales intelligence and operations snapshot.</p>
        </div>
        {/* Notification Bell */}
        <NotificationBell notifications={notifications} />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-neutral-600">Loading dashboard...</p> : null}

      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <KpiCard label="Total Sales" value={formatCurrency(data.totalSalesCents)} />
            <KpiCard label="Total Orders" value={String(data.totalOrders)} />
            <KpiCard label="Pending" value={String(data.pendingOrders)} />
            <KpiCard label="On Process" value={String(data.inProcessOrders)} />
            <KpiCard label="Delivered" value={String(data.deliveredOrders)} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Sales Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <SalesChart data={data.salesByDate} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Best-Selling Products</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {bestSellers.slice(0, 8).map((item) => (
                  <div key={`${item.product_id}-${item.product_name}`} className="flex items-center justify-between text-sm">
                    <span className="text-neutral-700">{item.product_name}</span>
                    <span className="font-medium text-neutral-900">{item.total_quantity}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {/* Designer Commissions */}
      <Card>
        <CardHeader>
          <CardTitle>Designer Commissions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-neutral-500">Commission = Total Players in Orders × ₱40.00</p>
          {commissions.length === 0 ? (
            <p className="text-sm text-neutral-500">No commission data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-neutral-500">
                    <th className="px-2 py-3">Designer</th>
                    <th className="px-2 py-3">Total Players</th>
                    <th className="px-2 py-3">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c) => (
                    <tr key={c.id} className="border-t border-neutral-200">
                      <td className="px-2 py-3 font-medium text-neutral-900">{c.full_name}</td>
                      <td className="px-2 py-3 text-neutral-700">{c.total_players}</td>
                      <td className="px-2 py-3 font-semibold text-green-700">{formatCurrency(c.total_commission_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Methods Management */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Methods</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {paymentMethods.map((pm) => (
            <div key={pm.id} className="flex items-center justify-between rounded-lg border border-neutral-200 p-3">
              <div className="flex items-center gap-3">
                <span className="font-medium text-neutral-900">{pm.name}</span>
                <Badge className={pm.is_available === 1 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-600"}>
                  {pm.is_available === 1 ? "Available" : "Unavailable"}
                </Badge>
              </div>
              <Button size="sm" variant="outline" onClick={() => togglePaymentMethod(pm)}>
                {pm.is_available === 1 ? "Disable" : "Enable"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationBell({ notifications }: { notifications: Array<{ id: string; message: string; time: Date }> }) {
  const [open, setOpen] = useState(false);
  const [readCount, setReadCount] = useState(0);
  const unread = notifications.length - readCount;

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen(!open);
          if (!open) setReadCount(notifications.length);
        }}
        className="relative rounded-full border border-neutral-200 bg-white p-2.5 text-neutral-700 hover:bg-neutral-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 rounded-xl border border-neutral-200 bg-white shadow-xl">
          <div className="border-b border-neutral-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-neutral-900">Notifications</h3>
          </div>
          <div className="max-h-64 overflow-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-neutral-500">No notifications yet</p>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="border-b border-neutral-100 px-4 py-3 last:border-b-0">
                  <p className="text-sm text-neutral-800">{n.message}</p>
                  <p className="mt-1 text-xs text-neutral-400">{n.time.toLocaleTimeString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
