"use client";

import { useState } from "react";
import { AnimatedPage } from "@/components/site/animated-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import { type ApiEnvelope, type Order } from "@/lib/types";

export default function TrackOrderPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTrack() {
    if (!orderNumber.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderNumber.trim())}`, { cache: "no-store" });
      const payload = (await response.json()) as ApiEnvelope<Order>;

      if (!response.ok || !payload.success) {
        const message = payload.success ? "Unable to fetch order" : payload.error?.message || "Unable to fetch order";
        throw new Error(message);
      }

      setOrder(payload.data as Order);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatedPage>
      <section className="mx-auto w-full max-w-3xl px-6 py-14">
        <h1 className="text-4xl font-semibold text-neutral-900">Track Your Order</h1>
        <p className="mt-3 text-neutral-600">Enter your order number to view live order progress.</p>

        <div className="mt-8 flex gap-3">
          <Input
            value={orderNumber}
            onChange={(event) => setOrderNumber(event.target.value)}
            placeholder="CO-20260325-12345"
          />
          <Button onClick={handleTrack} disabled={loading}>
            {loading ? "Checking..." : "Track"}
          </Button>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        {order ? (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>{order.order_number}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-neutral-700">
              <p>Status: {order.status}</p>
              <p>Customer: {order.customer_name}</p>
              <p>Total: {formatCurrency(order.total_cents)}</p>
              <p>Placed: {formatDate(order.placed_at)}</p>
            </CardContent>
          </Card>
        ) : null}
      </section>
    </AnimatedPage>
  );
}
