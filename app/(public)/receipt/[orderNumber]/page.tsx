"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AnimatedPage } from "@/components/site/animated-page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import { type ApiEnvelope, type Order } from "@/lib/types";

export default function ReceiptPage() {
  const params = useParams<{ orderNumber: string }>();
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    async function run() {
      const response = await fetch(`/api/orders/${encodeURIComponent(params.orderNumber)}`, { cache: "no-store" });
      const payload = (await response.json()) as ApiEnvelope<Order>;
      if (response.ok && payload.success) {
        setOrder(payload.data as Order);
      }
    }

    run();
  }, [params.orderNumber]);

  return (
    <AnimatedPage>
      <section className="mx-auto w-full max-w-3xl px-6 py-14">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Receipt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {order ? (
              <>
                <p className="text-sm text-neutral-600">Order Number: {order.order_number}</p>
                <p className="text-sm text-neutral-600">Issued: {formatDate(order.placed_at)}</p>
                <div className="h-px bg-neutral-200" />
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm text-neutral-700">
                    <span>
                      {item.product_name_snapshot} x {item.quantity}
                    </span>
                    <span>{formatCurrency(item.line_total_cents)}</span>
                  </div>
                ))}
                <div className="h-px bg-neutral-200" />
                <div className="flex items-center justify-between text-base font-semibold text-neutral-900">
                  <span>Total</span>
                  <span>{formatCurrency(order.total_cents)}</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-neutral-600">Loading receipt...</p>
            )}
          </CardContent>
        </Card>
      </section>
    </AnimatedPage>
  );
}
