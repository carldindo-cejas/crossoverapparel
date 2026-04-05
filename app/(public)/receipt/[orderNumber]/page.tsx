"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AnimatedPage } from "@/components/site/animated-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import { type ApiEnvelope, type Order } from "@/lib/types";

export default function ReceiptPage() {
  const params = useParams<{ orderNumber: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      try {
        const stored = (() => {
          try { return JSON.parse(sessionStorage.getItem(`ca_order_${params.orderNumber}`) ?? "{}"); }
          catch { return {}; }
        })();
        const phone: string | null = stored.phone ?? null;

        const response = await fetch(
          `/api/orders/${encodeURIComponent(params.orderNumber)}`,
          {
            cache: "no-store",
            headers: phone ? { "x-customer-phone": phone } : {},
          }
        );
        const payload = (await response.json()) as ApiEnvelope<Order>;
        if (!response.ok || !payload.success) {
          throw new Error(payload.success ? "Unable to load receipt" : payload.error?.message || "Unable to load receipt");
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
      <section className="mx-auto w-full max-w-3xl px-6 py-14 print:px-0 print:py-0">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Receipt</CardTitle>
              <p className="mt-1 text-xs text-neutral-500">Crossover Apparel</p>
            </div>
            {order && (
              <Button
                size="sm"
                variant="outline"
                className="print:hidden"
                onClick={() => window.print()}
              >
                Print
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-sm text-neutral-600">Loading receipt...</p>
            ) : error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : order ? (
              <>
                <div className="grid gap-1 text-sm text-neutral-600 sm:grid-cols-2">
                  <p>Order Number: <span className="font-medium text-neutral-900">{order.order_number}</span></p>
                  <p>Issued: <span className="font-medium text-neutral-900">{formatDate(order.placed_at)}</span></p>
                  <p>Customer: <span className="font-medium text-neutral-900">{order.customer_name}</span></p>
                  <p>Status: <span className="font-medium text-neutral-900 capitalize">{order.status.replace(/_/g, " ")}</span></p>
                </div>
                <div className="h-px bg-neutral-200" />
                <div className="rounded-lg border border-neutral-200">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 border-b border-neutral-200 px-4 py-2 text-xs font-medium text-neutral-500">
                    <span>Item</span>
                    <span>Qty</span>
                    <span>Unit Price</span>
                    <span className="text-right">Total</span>
                  </div>
                  {order.items.map((item) => {
                    const itemCustomizations = (order.customizations ?? []).filter(
                      (c) => c.order_item_id === item.id
                    );
                    return (
                      <div key={item.id} className="border-b border-neutral-100 last:border-b-0">
                        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2 text-sm text-neutral-700">
                          <span>{item.product_name_snapshot}</span>
                          <span>{item.quantity}</span>
                          <span>{formatCurrency(item.unit_price_cents)}</span>
                          <span className="text-right">{formatCurrency(item.line_total_cents)}</span>
                        </div>
                        {itemCustomizations.length > 0 && (
                          <div className="mx-4 mb-2 rounded-md bg-neutral-50 px-3 py-2 text-xs">
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
                  <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(order.subtotal_cents)}</span></div>
                  {order.tax_cents > 0 && <div className="flex justify-between"><span>Tax</span><span>{formatCurrency(order.tax_cents)}</span></div>}
                  {order.shipping_cents > 0 && <div className="flex justify-between"><span>Shipping</span><span>{formatCurrency(order.shipping_cents)}</span></div>}
                  {order.discount_cents > 0 && <div className="flex justify-between"><span>Discount</span><span>-{formatCurrency(order.discount_cents)}</span></div>}
                  <div className="h-px bg-neutral-200" />
                  <div className="flex items-center justify-between text-base font-semibold text-neutral-900">
                    <span>Total</span>
                    <span>{formatCurrency(order.total_cents)}</span>
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </AnimatedPage>
  );
}
