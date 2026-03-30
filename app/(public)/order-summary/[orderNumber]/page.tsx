"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AnimatedPage } from "@/components/site/animated-page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import { type ApiEnvelope, type Order } from "@/lib/types";

export default function OrderSummaryPage() {
  const params = useParams<{ orderNumber: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(params.orderNumber)}`, { cache: "no-store" });
        const payload = (await response.json()) as ApiEnvelope<Order>;

        if (!response.ok || !payload.success) {
          const message = payload.success ? "Unable to load order" : payload.error?.message || "Unable to load order";
          throw new Error(message);
        }

        setOrder(payload.data as Order);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    }

    run();
  }, [params.orderNumber]);

  return (
    <AnimatedPage>
      <section className="mx-auto w-full max-w-4xl px-6 py-14">
        <h1 className="text-4xl font-semibold text-neutral-900">Order Summary</h1>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        {order ? (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>{order.order_number}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-2 text-sm text-neutral-700 md:grid-cols-2">
                <p>Customer: {order.customer_name}</p>
                <p>Email: {order.customer_email}</p>
                <p>Status: {order.status}</p>
                <p>Placed: {formatDate(order.placed_at)}</p>
              </div>

              <div className="rounded-xl border border-neutral-200">
                <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-600">
                  <span>Item</span>
                  <span>Qty</span>
                  <span>Total</span>
                </div>
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-neutral-100 px-4 py-3 text-sm text-neutral-700 last:border-b-0"
                  >
                    <span>{item.product_name_snapshot}</span>
                    <span>{item.quantity}</span>
                    <span>{formatCurrency(item.line_total_cents)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-sm text-neutral-700">
                <p>Subtotal: {formatCurrency(order.subtotal_cents)}</p>
                <p>Tax: {formatCurrency(order.tax_cents)}</p>
                <p>Shipping: {formatCurrency(order.shipping_cents)}</p>
                <p className="text-base font-semibold text-neutral-900">
                  Total: {formatCurrency(order.total_cents)}
                </p>
              </div>

              <Link href={`/receipt/${order.order_number}`}>
                <Button>View Receipt</Button>
              </Link>
            </CardContent>
          </Card>
        ) : null}
      </section>
    </AnimatedPage>
  );
}
