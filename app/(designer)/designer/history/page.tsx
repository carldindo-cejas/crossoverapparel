"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
};

export default function DesignerHistoryPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/designer/orders", { cache: "no-store" });
      const payload = (await response.json()) as ApiEnvelope<OrderRow[]>;
      if (response.ok && payload.success) {
        setOrders(payload.data.filter((o) => o.status === "delivered"));
      }
    }
    load();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Completed Orders</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {orders.length === 0 ? (
          <p className="text-neutral-500">No completed orders yet.</p>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="rounded-xl border border-neutral-200 p-3">
              <p className="font-medium text-neutral-900">{order.order_number}</p>
              <p className="text-neutral-600">{order.customer_name}</p>
              <p className="text-neutral-600">
                {formatCurrency(order.total_cents, order.currency)}
              </p>
              <p className="text-neutral-500">Placed: {formatDate(order.placed_at)}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

