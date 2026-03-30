"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/format";
import { type ApiEnvelope } from "@/lib/types";

type Customization = {
  id: number;
  customization_type: string;
  field_name: string;
  field_value: string;
  order_item_id: number;
};

type DesignerOrderDetails = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  subtotal_cents: number;
  tax_cents: number;
  shipping_cents: number;
  discount_cents: number;
  total_cents: number;
  currency: string;
  placed_at: string;
  customer_name: string;
  customer_email: string;
  notes: string | null;
  items: Array<{
    id: number;
    product_name_snapshot: string;
    quantity: number;
    unit_price_cents: number;
    line_total_cents: number;
  }>;
  files: Array<{
    id: number;
    r2_key: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
  }>;
  history: Array<{
    id: number;
    previous_status: string | null;
    new_status: string;
    reason: string | null;
    changed_at: string;
  }>;
  customizations: Customization[];
};

const STATUSES = [
  "pending",
  "confirmed",
  "in_production",
  "ready_to_ship",
  "shipped",
  "delivered"
];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  in_production: "bg-purple-100 text-purple-800",
  ready_to_ship: "bg-indigo-100 text-indigo-800",
  shipped: "bg-cyan-100 text-cyan-800",
  delivered: "bg-green-100 text-green-800",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DesignerOrderDetailsPage() {
  const params = useParams<{ orderNumber: string }>();
  const [order, setOrder] = useState<DesignerOrderDetails | null>(null);
  const [nextStatus, setNextStatus] = useState("in_production");
  const [note, setNote] = useState("");
  const [updating, setUpdating] = useState(false);

  async function load() {
    const response = await fetch(`/api/designer/orders/${encodeURIComponent(params.orderNumber)}`, {
      cache: "no-store"
    });
    const payload = (await response.json()) as ApiEnvelope<DesignerOrderDetails>;

    if (response.ok && payload.success) {
      setOrder(payload.data);
      setNextStatus(payload.data.status);
    }
  }

  useEffect(() => {
    load();
  }, [params.orderNumber]);

  async function updateStatus() {
    if (!order) return;
    setUpdating(true);
    await fetch(`/api/designer/orders/${encodeURIComponent(order.order_number)}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });
    setUpdating(false);
    await load();
  }

  async function addNote() {
    if (!order || !note.trim()) return;
    await fetch(`/api/designer/orders/${encodeURIComponent(order.order_number)}/notes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: note.trim() })
    });
    setNote("");
    await load();
  }

  function isImageFile(mimeType: string) {
    return mimeType.startsWith("image/");
  }

  if (!order) {
    return <p className="text-sm text-neutral-600">Loading order details...</p>;
  }

  const imageFiles = order.files.filter((f) => isImageFile(f.mime_type));
  const otherFiles = order.files.filter((f) => !isImageFile(f.mime_type));

  return (
    <div className="space-y-6">
      {/* Order Summary Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-2xl">{order.order_number}</CardTitle>
            <Badge className={STATUS_COLORS[order.status] || "bg-neutral-100 text-neutral-600"}>
              {order.status.replace(/_/g, " ")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-medium text-neutral-500">Customer</p>
              <p className="font-medium text-neutral-900">{order.customer_name}</p>
              <p className="text-sm text-neutral-600">{order.customer_email}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-500">Placed</p>
              <p className="font-medium text-neutral-900">{formatDate(order.placed_at)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-500">Payment</p>
              <p className="font-medium text-neutral-900">{order.payment_status}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-500">Total</p>
              <p className="text-xl font-bold text-neutral-900">{formatCurrency(order.total_cents, order.currency)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Items */}
      <Card>
        <CardHeader>
          <CardTitle>Order Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {order.items.map((item) => {
              const itemCustomizations = order.customizations.filter(
                (c) => c.order_item_id === item.id
              );
              return (
                <div key={item.id} className="rounded-xl border border-neutral-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-neutral-900">{item.product_name_snapshot}</p>
                      <p className="text-sm text-neutral-600">
                        Qty: {item.quantity} &times; {formatCurrency(item.unit_price_cents)}
                      </p>
                    </div>
                    <p className="font-semibold text-neutral-900">{formatCurrency(item.line_total_cents)}</p>
                  </div>
                  {itemCustomizations.length > 0 && (
                    <div className="mt-3 space-y-1 rounded-lg bg-neutral-50 p-3">
                      <p className="text-xs font-semibold uppercase text-neutral-500">Customizations</p>
                      {itemCustomizations.map((c) => (
                        <div key={c.id} className="flex justify-between text-sm">
                          <span className="text-neutral-600">{c.field_name}</span>
                          <span className="font-medium text-neutral-900">{c.field_value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 space-y-1 border-t border-neutral-200 pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-600">Subtotal</span>
              <span>{formatCurrency(order.subtotal_cents)}</span>
            </div>
            {order.shipping_cents > 0 && (
              <div className="flex justify-between">
                <span className="text-neutral-600">Shipping</span>
                <span>{formatCurrency(order.shipping_cents)}</span>
              </div>
            )}
            {order.tax_cents > 0 && (
              <div className="flex justify-between">
                <span className="text-neutral-600">Tax</span>
                <span>{formatCurrency(order.tax_cents)}</span>
              </div>
            )}
            {order.discount_cents > 0 && (
              <div className="flex justify-between">
                <span className="text-neutral-600">Discount</span>
                <span className="text-green-600">-{formatCurrency(order.discount_cents)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-bold">
              <span>Total</span>
              <span>{formatCurrency(order.total_cents)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Photo Attachments */}
      {imageFiles.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Photo Attachments ({imageFiles.length})</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  imageFiles.forEach((f) => {
                    const a = document.createElement("a");
                    a.href = `/api/orders/files/${f.r2_key}`;
                    a.download = f.file_name;
                    a.click();
                  });
                }}
              >
                Download All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {imageFiles.map((file) => (
                <div key={file.id} className="group relative overflow-hidden rounded-xl border border-neutral-200">
                  <img
                    src={`/api/orders/files/${file.r2_key}`}
                    alt={file.file_name}
                    className="h-48 w-full object-cover"
                  />
                  <div className="p-3">
                    <p className="truncate text-sm font-medium text-neutral-900">{file.file_name}</p>
                    <p className="text-xs text-neutral-500">{formatBytes(file.size_bytes)}</p>
                    <a
                      href={`/api/orders/files/${file.r2_key}`}
                      download={file.file_name}
                      className="mt-2 inline-block rounded-lg bg-neutral-900 px-3 py-1 text-xs text-white hover:bg-neutral-700"
                    >
                      Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Other Files */}
      {otherFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Other Files ({otherFiles.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {otherFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between rounded-xl border border-neutral-200 p-3 text-sm">
                <div>
                  <p className="font-medium text-neutral-900">{file.file_name}</p>
                  <p className="text-neutral-500">{formatBytes(file.size_bytes)} &middot; {formatDate(file.created_at)}</p>
                </div>
                <a
                  href={`/api/orders/files/${file.r2_key}`}
                  download={file.file_name}
                  className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs text-white hover:bg-neutral-700"
                >
                  Download
                </a>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {order.files.length === 0 && (
        <Card>
          <CardHeader><CardTitle>Files</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-neutral-500">No files attached to this order.</p></CardContent>
        </Card>
      )}

      {/* Update Status */}
      <Card>
        <CardHeader>
          <CardTitle>Update Order Status</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <select
            className="h-10 rounded-xl border border-neutral-300 px-3"
            value={nextStatus}
            onChange={(event) => setNextStatus(event.target.value)}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <Button onClick={updateStatus} disabled={updating || nextStatus === order.status}>
            {updating ? "Saving..." : "Save Status"}
          </Button>
          <span className="text-sm text-neutral-500">
            Current: <span className="font-medium">{order.status.replace(/_/g, " ")}</span>
          </span>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a note about this order..." />
          <Button onClick={addNote} disabled={!note.trim()}>Add Note</Button>
          {order.notes ? (
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
              {order.notes}
            </pre>
          ) : (
            <p className="text-sm text-neutral-500">No notes yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Status History */}
      <Card>
        <CardHeader>
          <CardTitle>Status History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {order.history.length === 0 ? (
            <p className="text-neutral-500">No status changes recorded.</p>
          ) : (
            order.history.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-neutral-200 p-3">
                <p className="font-medium text-neutral-900">
                  {entry.previous_status || "–"} → {entry.new_status}
                </p>
                {entry.reason && <p className="text-neutral-600">{entry.reason}</p>}
                <p className="text-neutral-500">{formatDate(entry.changed_at)}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
