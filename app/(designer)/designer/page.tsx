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
  assignment_status: string;
};

// Map assignment_status to designer-facing label
const ASSIGNMENT_TO_DESIGNER: Record<string, string> = {
  assigned: "received",
  in_progress: "working",
  completed: "done",
};

function getDesignerStatus(assignmentStatus: string): string {
  return ASSIGNMENT_TO_DESIGNER[assignmentStatus] ?? "received";
}

const DESIGNER_STATUSES = ["received", "working", "done"] as const;

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
      if (event.type === "order.status.updated" || event.type === "assignment.updated") {
        load();
        loadCommission();
      }
    }
  });

  async function updateOrderStatus(orderNumber: string, designerStatus: string) {
    const order = orders.find((o) => o.order_number === orderNumber);
    const previousAssignment = order?.assignment_status;

    // Map designer status back to assignment status for optimistic UI
    const designerToAssignment: Record<string, string> = {
      received: "assigned",
      working: "in_progress",
      done: "completed",
    };

    setStatusUpdatingByOrder((prev) => ({ ...prev, [orderNumber]: true }));
    setOrders((prev) =>
      prev.map((o) => (o.order_number === orderNumber ? { ...o, assignment_status: designerToAssignment[designerStatus] ?? o.assignment_status } : o))
    );

    const response = await fetch(
      `/api/designer/orders/${encodeURIComponent(orderNumber)}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: designerStatus })
      }
    );

    if (!response.ok && previousAssignment) {
      setOrders((prev) =>
        prev.map((o) =>
          o.order_number === orderNumber ? { ...o, assignment_status: previousAssignment } : o
        )
      );
    }

    setStatusUpdatingByOrder((prev) => ({ ...prev, [orderNumber]: false }));
    void load();
    void loadCommission();
  }

  const grouped = useMemo(
    () => ({
      received: orders.filter((o) => getDesignerStatus(o.assignment_status) === "received"),
      working: orders.filter((o) => getDesignerStatus(o.assignment_status) === "working"),
      done: orders.filter((o) => getDesignerStatus(o.assignment_status) === "done"),
    }),
    [orders]
  );

  function designerStatusColor(ds: string): string {
    switch (ds) {
      case "received": return "bg-blue-100 text-blue-800";
      case "working":  return "bg-orange-100 text-orange-800";
      case "done":     return "bg-green-100 text-green-800";
      default:         return "bg-neutral-100 text-neutral-800";
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
                    <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${designerStatusColor(getDesignerStatus(order.assignment_status))}`}>
                      {getDesignerStatus(order.assignment_status)}
                    </span>
                    <select
                      className="h-9 rounded-lg border border-neutral-300 px-2 text-sm"
                      value={getDesignerStatus(order.assignment_status)}
                      disabled={statusUpdatingByOrder[order.order_number] === true || getDesignerStatus(order.assignment_status) === "done"}
                      onChange={(e) => updateOrderStatus(order.order_number, e.target.value)}
                    >
                      {DESIGNER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
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
            <CardTitle>Received</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{grouped.received.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Working</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{grouped.working.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Done</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{grouped.done.length}</p>
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
          <CardTitle>Received Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderTable rows={grouped.received} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Working</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderTable rows={grouped.working} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Done</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderTable rows={grouped.done} />
        </CardContent>
      </Card>
    </div>
  );
}
