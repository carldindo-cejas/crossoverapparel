"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRealtime } from "@/hooks/use-realtime";
import { formatCurrency, formatDate } from "@/lib/format";
import { type ApiEnvelope, type Order, type StaffRecord } from "@/lib/types";

const PAGE_SIZE = 20;

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
  const [assignErrorByOrder, setAssignErrorByOrder] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter(
      (o) =>
        o.order_number.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_email.toLowerCase().includes(q)
    );
  }, [orders, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  async function load() {
    setLoading(true);
    try {
      const [ordersRes, staffRes] = await Promise.all([
        fetch("/api/admin/orders", { cache: "no-store" }),
        fetch("/api/admin/staff", { cache: "no-store" })
      ]);

      const ordersPayload = (await ordersRes.json()) as ApiEnvelope<OrderRow[]>;
      const staffPayload = (await staffRes.json()) as ApiEnvelope<StaffRecord[]>;

      if (ordersRes.ok && ordersPayload.success) setOrders(ordersPayload.data);
      if (staffRes.ok && staffPayload.success) {
        setDesigners(staffPayload.data);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useRealtime({
    role: "owner",
    onEvent: (event) => {
      if (event.type === "assignment.updated" || event.type === "order.status.updated" || event.type === "order.created") {
        load();
      }
    }
  });

  async function assignDesigner(orderId: string) {
    const designerUserId = designerByOrder[orderId];
    if (!designerUserId) {
      setAssignErrorByOrder((prev) => ({ ...prev, [orderId]: "Please select a designer first." }));
      return;
    }

    setAssignErrorByOrder((prev) => ({ ...prev, [orderId]: "" }));
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

    const response = await fetch(`/api/admin/orders/${orderId}/assign-designer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ designerUserId })
    });

    if (!response.ok) {
      if (previous) {
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
      try {
        const errPayload = (await response.json()) as { error?: { message?: string } };
        setAssignErrorByOrder((prev) => ({
          ...prev,
          [orderId]: errPayload.error?.message || `Assignment failed (${response.status})`
        }));
      } catch {
        setAssignErrorByOrder((prev) => ({
          ...prev,
          [orderId]: `Assignment failed (${response.status})`
        }));
      }
    }

    setAssigningByOrder((prev) => ({ ...prev, [orderId]: false }));
    void load();
  }

  function statusColor(status: string): string {
    switch (status) {
      case "pending":       return "bg-yellow-100 text-yellow-800";
      case "confirmed":     return "bg-blue-100 text-blue-800";
      case "in_production": return "bg-orange-100 text-orange-800";
      case "ready_to_ship": return "bg-purple-100 text-purple-800";
      case "shipped":       return "bg-indigo-100 text-indigo-800";
      case "delivered":     return "bg-green-100 text-green-800";
      default:              return "bg-neutral-100 text-neutral-800";
    }
  }

  function paymentStatusColor(status: string): string {
    switch (status) {
      case "paid":     return "bg-green-100 text-green-800";
      case "partial":  return "bg-yellow-100 text-yellow-800";
      case "refunded": return "bg-blue-100 text-blue-800";
      case "failed":   return "bg-red-100 text-red-800";
      default:         return "bg-red-50 text-red-600";
    }
  }

  async function updateStatus(orderId: string, status: string) {
    const previousStatus = orders.find((order) => order.id === orderId)?.status;

    setStatusUpdatingByOrder((prev) => ({ ...prev, [orderId]: true }));
    setOrders((prev) => prev.map((order) => (order.id === orderId ? { ...order, status } : order)));

    const response = await fetch(`/api/admin/orders/${orderId}/status`, {
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Orders ({filtered.length})</CardTitle>
            <Input
              placeholder="Search orders..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="max-w-xs"
              aria-label="Search orders"
            />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading && orders.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-600">Loading orders...</p>
          ) : (
            <>
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-neutral-500">
              <tr>
                <th className="px-2 py-3">Order</th>
                <th className="px-2 py-3">Customer</th>
                <th className="px-2 py-3">Placed</th>
                <th className="px-2 py-3">Total</th>
                <th className="px-2 py-3">Payment</th>
                <th className="px-2 py-3">Status</th>
                <th className="px-2 py-3">Staff</th>
                <th className="px-2 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((order) => (
                <tr key={order.id} className="border-t border-neutral-200">
                  <td className="px-2 py-3 font-medium text-neutral-900">{order.order_number}</td>
                  <td className="px-2 py-3 text-neutral-700">{order.customer_name}</td>
                  <td className="px-2 py-3 text-neutral-700">{formatDate(order.placed_at)}</td>
                  <td className="px-2 py-3 text-neutral-700">
                    {formatCurrency(order.total_cents, order.currency)}
                  </td>
                  <td className="px-2 py-3">
                    <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${paymentStatusColor(order.payment_status)}`}>
                      {order.payment_status === "paid" ? "Paid" : order.payment_status === "partial" ? "Partial" : order.payment_status === "refunded" ? "Refunded" : order.payment_status === "failed" ? "Failed" : "Unpaid"}
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex flex-col gap-1.5">
                      <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColor(order.status)}`}>
                        {order.status.replace(/_/g, " ")}
                      </span>
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
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    {order.assignment_designer_id ? (
                      <div>
                        <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-800">
                          {order.assignment_designer_name}
                        </span>
                      </div>
                    ) : (
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
                        disabled={assigningByOrder[order.id] === true || !designerByOrder[order.id]}
                        onClick={() => assignDesigner(order.id)}
                      >
                        {assigningByOrder[order.id] ? "Assigning..." : "Assign"}
                      </Button>
                    </div>
                    )}
                    {assignErrorByOrder[order.id] && (
                      <p className="mt-1 text-xs text-red-600">{assignErrorByOrder[order.id]}</p>
                    )}
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
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-sm text-neutral-600">
                Page {page + 1} of {totalPages}
              </span>
              <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
            </>
          )}
        </CardContent>
      </Card>

      {selectedOrder ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Files for {selectedOrder.order_number}</CardTitle>
              {selectedOrder.files.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    selectedOrder.files.forEach((f) => {
                      const a = document.createElement("a");
                      a.href = `/api/orders/files/${f.r2_key}`;
                      a.download = f.file_name;
                      a.click();
                    });
                  }}
                >
                  Download All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {selectedOrder.files.length === 0 ? (
              <p className="text-sm text-neutral-600">No uploaded files.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {selectedOrder.files.map((file) => {
                  const isImage = file.mime_type.startsWith("image/");
                  const labelMatch = file.file_name.match(/^\[(.+?)]\s*(.*)/);
                  const label = labelMatch ? labelMatch[1] : null;
                  const cleanName = labelMatch ? labelMatch[2] || file.file_name : file.file_name;
                  return (
                    <div key={file.id} className="overflow-hidden rounded-xl border border-neutral-200">
                      {isImage ? (
                        <img
                          src={`/api/orders/files/${file.r2_key}`}
                          alt={cleanName}
                          className="h-48 w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-48 items-center justify-center bg-neutral-100 text-neutral-400">
                          <span className="text-4xl">📄</span>
                        </div>
                      )}
                      <div className="p-3">
                        {label && (
                          <span className="mb-1 inline-block rounded bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600">
                            {label}
                          </span>
                        )}
                        <p className="truncate text-sm font-medium text-neutral-900">{cleanName}</p>
                        <p className="text-xs text-neutral-500">
                          {(file.size_bytes / 1024).toFixed(1)} KB
                        </p>
                        <a
                          href={`/api/orders/files/${file.r2_key}`}
                          download={cleanName}
                          className="mt-2 inline-block rounded-lg bg-neutral-900 px-3 py-1 text-xs text-white hover:bg-neutral-700"
                        >
                          Download
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
