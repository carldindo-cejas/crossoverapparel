"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AnimatedPage } from "@/components/site/animated-page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LightningPayment } from "@/components/lightning-payment";
import { formatCurrency, formatDate } from "@/lib/format";
import { type ApiEnvelope, type Order } from "@/lib/types";

export default function OrderSummaryPage() {
  const params = useParams<{ orderNumber: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [customerPhone, setCustomerPhone] = useState<string | undefined>(undefined);

  useEffect(() => {
    async function run() {
      try {
        const stored = (() => {
          try { return JSON.parse(sessionStorage.getItem(`ca_order_${params.orderNumber}`) ?? "{}"); }
          catch { return {}; }
        })();
        const phone: string | null = stored.phone ?? null;
        if (phone) setCustomerPhone(phone);

        const response = await fetch(
          `/api/orders/${encodeURIComponent(params.orderNumber)}`,
          {
            cache: "no-store",
            headers: phone ? { "x-customer-phone": phone } : {},
          }
        );
        const payload = (await response.json()) as ApiEnvelope<Order>;

        if (!response.ok || !payload.success) {
          const message = payload.success ? "Unable to load order" : payload.error?.message || "Unable to load order";
          throw new Error(message);
        }

        setOrder(payload.data as Order);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    run();
  }, [params.orderNumber]);

  return (
    <AnimatedPage>
      <section className="mx-auto w-full max-w-4xl px-6 py-14">
        <h1 className="text-4xl font-semibold text-neutral-900">Order Summary</h1>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        {loading && !error ? <p className="mt-4 text-sm text-neutral-600">Loading order details...</p> : null}

        {order ? (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>{order.order_number}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-2 text-sm text-neutral-700 md:grid-cols-2">
                <p>Customer: {order.customer_name}</p>
                <p>Status: {order.status}</p>
                <p>Placed: {formatDate(order.placed_at)}</p>
              </div>

              <div className="rounded-xl border border-neutral-200">
                <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-600">
                  <span>Item</span>
                  <span>Qty</span>
                  <span>Total</span>
                </div>
                {order.items.map((item) => {
                  const itemCustomizations = (order.customizations ?? []).filter(
                    (c) => c.order_item_id === item.id
                  );
                  return (
                    <div key={item.id} className="border-b border-neutral-100 last:border-b-0">
                      <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-3 text-sm text-neutral-700">
                        <span>{item.product_name_snapshot}</span>
                        <span>{item.quantity}</span>
                        <span>{formatCurrency(item.line_total_cents)}</span>
                      </div>
                      {itemCustomizations.length > 0 && (
                        <div className="mx-4 mb-3 rounded-lg bg-neutral-50 px-3 py-2 text-xs">
                          {itemCustomizations.map((c) => (
                            <div key={c.id} className="flex justify-between py-0.5">
                              <span className="text-neutral-500">{c.field_name}</span>
                              <span className="font-medium text-neutral-700">{c.field_value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="space-y-1 text-sm text-neutral-700">
                {order.items.map((item) => (
                  <p key={`summary-${item.id}`}>
                    {item.product_name_snapshot}: {item.quantity} player{item.quantity !== 1 ? "s" : ""} × {formatCurrency(item.unit_price_cents)} = {formatCurrency(item.line_total_cents)}
                  </p>
                ))}
                <div className="my-2 border-t border-neutral-200" />
                <p>Subtotal: {formatCurrency(order.subtotal_cents)}</p>
                {order.tax_cents > 0 && <p>Tax: {formatCurrency(order.tax_cents)}</p>}
                {order.shipping_cents > 0 && <p>Shipping: {formatCurrency(order.shipping_cents)}</p>}
                {order.discount_cents > 0 && <p>Discount: -{formatCurrency(order.discount_cents)}</p>}
                <p className="text-lg font-semibold text-neutral-900">
                  Total Payable: {formatCurrency(order.total_cents)}
                </p>
              </div>

              <Link href={`/receipt/${order.order_number}`}>
                <Button>View Receipt</Button>
              </Link>

              {/* Lightning payment if customer chose Bitcoin Lightning */}
              {(order.customizations ?? []).some(
                (c) => c.field_name === "paymentMethod" && c.field_value === "Pay with Bitcoin Lightning"
              ) && order.status === "pending" && (
                <LightningPayment
                  orderNumber={order.order_number}
                  totalCents={order.total_cents}
                  phone={customerPhone}
                />
              )}
            </CardContent>
          </Card>
        ) : null}
      </section>
    </AnimatedPage>
  );
}
