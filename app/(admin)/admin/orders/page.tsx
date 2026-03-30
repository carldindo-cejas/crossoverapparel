"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRealtime } from "@/hooks/use-realtime";
import { formatCurrency, formatDate } from "@/lib/format";
import { type ApiEnvelope, type Order, type StaffRecord } from "@/lib/types";

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total_cents: number;
  currency: string;
  placed_at: string;
  customer_email: string;
  customer_name: string;
  assignment_designer_id: string | null;
  assignment_designer_name: string | null;
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [designers, setDesigners] = useState<StaffRecord[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [designerByOrder, setDesignerByOrder] = useState<Record<string, string>>({});
  const [statusUpdatingByOrder, setStatusUpdatingByOrder] = useState<Record<string, boolean>>({});
  const [assigningByOrder, setAssigningByOrder] = useState<Record<string, boolean>>({});

  async function load() {
    const [ordersRes, staffRes] = await Promise.all([
      fetch("/api/owner/orders", { cache: "no-store" }),
      fetch("/api/owner/staff", { cache: "no-store" })
    ]);

    const ordersPayload = (await ordersRes.json()) as ApiEnvelope<OrderRow[]>;
    const staffPayload = (await staffRes.json()) as ApiEnvelope<StaffRecord[]>;

    if (ordersRes.ok && ordersPayload.success) setOrders(ordersPayload.data);
    if (staffRes.ok && staffPayload.success) {
      setDesigners(staffPayload.data);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useRealtime({
    role: "owner",
    onEvent: (event) => {
      if (event.type === "assignment.updated" || event.type === "order.status.updated") {
        load();
      }
    }
  });

  async function assignDesigner(orderId: string) {
    const designerUserId = designerByOrder[orderId];
    if (!designerUserId) return;

    const previous = orders.find((order) => order.id === orderId);
    const selectedDesigner = designers.find((designer) => designer.id === designerUserId);

    setAssigningByOrder((prev) => ({ ...prev, [orderId]: true }));
    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId
          ? {
              ...order,
              assignment_designer_id: designerUserId,
              assignment_designer_name: selectedDesigner?.full_name || order.assignment_designer_name
            }
          : order
      )
    );

    const response = await fetch(`/api/owner/orders/${orderId}/assign-designer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ designerUserId })
    });

    if (!response.ok && previous) {
      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? {
                ...order,
                assignment_designer_id: previous.assignment_designer_id,
                assignment_designer_name: previous.assignment_designer_name
              }
            : order
        )
      );
    }

    setAssigningByOrder((prev) => ({ ...prev, [orderId]: false }));
    void load();
  }

  async function updateStatus(orderId: string, status: string) {
    const previousStatus = orders.find((order) => order.id === orderId)?.status;

    setStatusUpdatingByOrder((prev) => ({ ...prev, [orderId]: true }));
    setOrders((prev) => prev.map((order) => (order.id === orderId ? { ...order, status } : order)));

    const response = await fetch(`/api/owner/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });

    if (!response.ok && previousStatus) {
      setOrders((prev) =>
        prev.map((order) => (order.id === orderId ? { ...order, status: previousStatus } : order))
      );
    }

    setStatusUpdatingByOrder((prev) => ({ ...prev, [orderId]: false }));
    void load();
  }

  async function viewOrder(orderNumber: string) {
    const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}`, { cache: "no-store" });
    const payload = (await res.json()) as ApiEnvelope<Order>;
    if (res.ok && payload.success) {
      setSelectedOrder(payload.data);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-semibold text-neutral-900">Order Management</h1>

      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-neutral-500">
              <tr>
                <th className="px-2 py-3">Order</th>
                <th className="px-2 py-3">Customer</th>
                <th className="px-2 py-3">Placed</th>
                <th className="px-2 py-3">Total</th>
                <th className="px-2 py-3">Status</th>
                <th className="px-2 py-3">Staff</th>
                <th className="px-2 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-neutral-200">
                  <td className="px-2 py-3 font-medium text-neutral-900">{order.order_number}</td>
                  <td className="px-2 py-3 text-neutral-700">{order.customer_name}</td>
                  <td className="px-2 py-3 text-neutral-700">{formatDate(order.placed_at)}</td>
                  <td className="px-2 py-3 text-neutral-700">
                    {formatCurrency(order.total_cents, order.currency)}
                  </td>
                  <td className="px-2 py-3">
                    <select
                      className="h-9 rounded-lg border border-neutral-300 px-2"
                      value={order.status}
                      disabled={statusUpdatingByOrder[order.id] === true}
                      onChange={(event) => updateStatus(order.id, event.target.value)}
                    >
                      {[
                        "pending",
                        "confirmed",
                        "in_production",
                        "ready_to_ship",
                        "shipped",
                        "delivered",
                        "cancelled",
                        "refunded"
                      ].map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex gap-2">
                      <select
                        className="h-9 rounded-lg border border-neutral-300 px-2"
                        value={designerByOrder[order.id] || ""}
                        disabled={assigningByOrder[order.id] === true}
                        onChange={(event) =>
                          setDesignerByOrder((prev) => ({ ...prev, [order.id]: event.target.value }))
                        }
                      >
                        <option value="">Select</option>
                        {designers.map((staffMember) => (
                          <option key={staffMember.id} value={staffMember.id}>
                            {staffMember.full_name}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={assigningByOrder[order.id] === true}
                        onClick={() => assignDesigner(order.id)}
                      >
                        {assigningByOrder[order.id] ? "Assigning..." : "Assign"}
                      </Button>
                    </div>
                    {order.assignment_designer_name ? (
                      <p className="mt-1 text-xs text-neutral-500">Current: {order.assignment_designer_name}</p>
                    ) : null}
                  </td>
                  <td className="px-2 py-3">
                    <Button size="sm" variant="outline" onClick={() => viewOrder(order.order_number)}>
                      View files
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {selectedOrder ? (
        <Card>
          <CardHeader>
            <CardTitle>Files for {selectedOrder.order_number}</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedOrder.files.length === 0 ? (
              <p className="text-sm text-neutral-600">No uploaded files.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {selectedOrder.files.map((file) => (
                  <li key={file.id} className="flex items-center justify-between rounded-lg border border-neutral-200 p-3">
                    <span>{file.file_name}</span>
                    <a
                      className="text-neutral-900 underline"
                      href={`/api/orders/files/${file.r2_key}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
