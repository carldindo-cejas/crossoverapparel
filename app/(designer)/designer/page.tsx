"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRealtime } from "@/hooks/use-realtime";
import { formatCurrency, formatDate } from "@/lib/format";
import { type ApiEnvelope } from "@/lib/types";

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total_cents: number;
  currency: string;
  placed_at: string;
  customer_name: string;
  customer_email: string;
};

const NEW_STATUSES = ["pending", "confirmed"];
const IN_PROGRESS_STATUSES = ["in_production", "ready_to_ship", "shipped"];
const COMPLETE_STATUSES = ["delivered"];

const DESIGNER_STATUSES = [
  "pending",
  "confirmed",
  "in_production",
  "ready_to_ship",
  "shipped",
  "delivered"
];

export default function DesignerOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [statusUpdatingByOrder, setStatusUpdatingByOrder] = useState<Record<string, boolean>>({});
  const [commission, setCommission] = useState<{ total_players: number; total_commission_cents: number } | null>(null);

  async function load() {
    const response = await fetch("/api/designer/orders", { cache: "no-store" });
    const payload = (await response.json()) as ApiEnvelope<OrderRow[]>;
    if (response.ok && payload.success) {
      setOrders(payload.data);
    }
  }

  async function loadCommission() {
    const response = await fetch("/api/designer/commission", { cache: "no-store" });
    const payload = (await response.json()) as ApiEnvelope<{ total_players: number; total_commission_cents: number }>;
    if (response.ok && payload.success) {
      setCommission(payload.data);
    }
  }

  useEffect(() => {
    load();
    loadCommission();
  }, []);

  useRealtime({
    role: "designer",
    onEvent: (event) => {
      if (event.type === "order.status.updated") {
        load();
        loadCommission();
      }
    }
  });

  async function updateOrderStatus(orderNumber: string, status: string) {
    const order = orders.find((o) => o.order_number === orderNumber);
    const previousStatus = order?.status;

    setStatusUpdatingByOrder((prev) => ({ ...prev, [orderNumber]: true }));
    setOrders((prev) =>
      prev.map((o) => (o.order_number === orderNumber ? { ...o, status } : o))
    );

    const response = await fetch(
      `/api/designer/orders/${encodeURIComponent(orderNumber)}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      }
    );

    if (!response.ok && previousStatus) {
      setOrders((prev) =>
        prev.map((o) =>
          o.order_number === orderNumber ? { ...o, status: previousStatus } : o
        )
      );
    }

    setStatusUpdatingByOrder((prev) => ({ ...prev, [orderNumber]: false }));
    void load();
    void loadCommission();
  }

  const grouped = useMemo(
    () => ({
      new: orders.filter((o) => NEW_STATUSES.includes(o.status)),
      inProgress: orders.filter((o) => IN_PROGRESS_STATUSES.includes(o.status)),
      complete: orders.filter((o) => COMPLETE_STATUSES.includes(o.status))
    }),
    [orders]
  );

  function statusColor(status: string): string {
    switch (status) {
      case "pending":      return "bg-yellow-100 text-yellow-800";
      case "confirmed":    return "bg-blue-100 text-blue-800";
      case "in_production": return "bg-orange-100 text-orange-800";
      case "ready_to_ship": return "bg-purple-100 text-purple-800";
      case "shipped":      return "bg-indigo-100 text-indigo-800";
      case "delivered":    return "bg-green-100 text-green-800";
      default:             return "bg-neutral-100 text-neutral-800";
    }
  }

  function OrderTable({ rows }: { rows: OrderRow[] }) {
    if (rows.length === 0) {
      return <p className="py-4 text-sm text-neutral-500">No orders.</p>;
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="text-neutral-500">
              <th className="px-2 py-3">Order</th>
              <th className="px-2 py-3">Customer</th>
              <th className="px-2 py-3">Placed</th>
              <th className="px-2 py-3">Total</th>
              <th className="px-2 py-3">Status</th>
              <th className="px-2 py-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((order) => (
              <tr key={order.id} className="border-t border-neutral-200">
                <td className="px-2 py-3 font-medium text-neutral-900">{order.order_number}</td>
                <td className="px-2 py-3 text-neutral-700">{order.customer_name}</td>
                <td className="px-2 py-3 text-neutral-700">{formatDate(order.placed_at)}</td>
                <td className="px-2 py-3 text-neutral-700">
                  {formatCurrency(order.total_cents, order.currency)}
                </td>
                <td className="px-2 py-3">
                  <div className="flex flex-col gap-1.5">
                    <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColor(order.status)}`}>
                      {order.status.replace(/_/g, " ")}
                    </span>
                    <select
                      className="h-9 rounded-lg border border-neutral-300 px-2 text-sm"
                      value={order.status}
                      disabled={statusUpdatingByOrder[order.order_number] === true}
                      onChange={(e) => updateOrderStatus(order.order_number, e.target.value)}
                    >
                      {DESIGNER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
                <td className="px-2 py-3">
                  <Link href={`/designer/orders/${order.order_number}` as Route}>
                    <Button size="sm" variant="outline">
                      Open
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-semibold text-neutral-900">Order List</h2>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>New</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{grouped.new.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{grouped.inProgress.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Complete</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{grouped.complete.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>My Commission</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-green-600">
              {commission ? formatCurrency(commission.total_commission_cents) : "—"}
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              {commission ? `${commission.total_players} players × ₱40.00` : "Loading..."}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderTable rows={grouped.new} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>In Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderTable rows={grouped.inProgress} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Complete</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderTable rows={grouped.complete} />
        </CardContent>
      </Card>
    </div>
  );
}
