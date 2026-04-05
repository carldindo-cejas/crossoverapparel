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
  assignment_status: string;
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

const DESIGNER_STATUSES = ["received", "working", "done"] as const;

const ASSIGNMENT_TO_DESIGNER: Record<string, string> = {
  assigned: "received",
  in_progress: "working",
  completed: "done",
};

function getDesignerStatus(assignmentStatus: string): string {
  return ASSIGNMENT_TO_DESIGNER[assignmentStatus] ?? "received";
}

const DESIGNER_STATUS_COLORS: Record<string, string> = {
  received: "bg-blue-100 text-blue-800",
  working: "bg-orange-100 text-orange-800",
  done: "bg-green-100 text-green-800",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DesignerOrderDetailsPage() {
  const params = useParams<{ orderNumber: string }>();
  const [order, setOrder] = useState<DesignerOrderDetails | null>(null);
  const [nextStatus, setNextStatus] = useState("received");
  const [note, setNote] = useState("");
  const [updating, setUpdating] = useState(false);

  async function load() {
    const response = await fetch(`/api/designer/orders/${encodeURIComponent(params.orderNumber)}`, {
      cache: "no-store"
    });
    const payload = (await response.json()) as ApiEnvelope<DesignerOrderDetails>;

    if (response.ok && payload.success) {
      setOrder(payload.data);
      setNextStatus(getDesignerStatus(payload.data.assignment_status));
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
            <Badge className={DESIGNER_STATUS_COLORS[getDesignerStatus(order.assignment_status)] || "bg-neutral-100 text-neutral-600"}>
              {getDesignerStatus(order.assignment_status)}
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

      {/* Customer Attachments — grouped by label */}
      {order.files.length > 0 ? (() => {
        const LABEL_ORDER = ["Product Photo", "Logo Left", "Logo Right", "Logo Back"];
        function parseLabel(fileName: string): { label: string; cleanName: string } {
          const m = fileName.match(/^\[(.+?)]\s*(.*)/);
          return m ? { label: m[1], cleanName: m[2] || fileName } : { label: "", cleanName: fileName };
        }
        const labeled = order.files.map((f) => ({ ...f, ...parseLabel(f.file_name) }));
        const grouped: Record<string, typeof labeled> = {};
        for (const f of labeled) {
          const key = f.label || "Other Files";
          (grouped[key] ??= []).push(f);
        }
        const sortedKeys = [
          ...LABEL_ORDER.filter((k) => grouped[k]),
          ...Object.keys(grouped).filter((k) => !LABEL_ORDER.includes(k))
        ];
        return (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Customer Attachments ({order.files.length})</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    order.files.forEach((f) => {
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
            <CardContent className="space-y-6">
              {sortedKeys.map((label) => (
                <div key={label}>
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-neutral-500">{label}</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {grouped[label].map((file) => (
                      <div key={file.id} className="overflow-hidden rounded-xl border border-neutral-200">
                        {isImageFile(file.mime_type) ? (
                          <img
                            src={`/api/orders/files/${file.r2_key}`}
                            alt={file.cleanName}
                            className="h-56 w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-56 items-center justify-center bg-neutral-100 text-neutral-400">
                            <span className="text-4xl">📄</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between p-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-neutral-900">{file.cleanName}</p>
                            <p className="text-xs text-neutral-500">{formatBytes(file.size_bytes)}</p>
                          </div>
                          <a
                            href={`/api/orders/files/${file.r2_key}`}
                            download={file.cleanName}
                            className="ml-3 shrink-0 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs text-white hover:bg-neutral-700"
                          >
                            Download
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })() : (
        <Card>
          <CardHeader><CardTitle>Files</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-neutral-500">No files attached to this order.</p></CardContent>
        </Card>
      )}

      {/* Update Status */}
      <Card>
        <CardHeader>
          <CardTitle>Update Designer Status</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <select
            className="h-10 rounded-xl border border-neutral-300 px-3"
            value={nextStatus}
            disabled={getDesignerStatus(order.assignment_status) === "done"}
            onChange={(event) => setNextStatus(event.target.value)}
          >
            {DESIGNER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
          <Button onClick={updateStatus} disabled={updating || nextStatus === getDesignerStatus(order.assignment_status) || getDesignerStatus(order.assignment_status) === "done"}>
            {updating ? "Saving..." : "Save Status"}
          </Button>
          <span className="text-sm text-neutral-500">
            Current: <span className="font-medium capitalize">{getDesignerStatus(order.assignment_status)}</span>
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
