"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatedPage } from "@/components/site/animated-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LightningPayment } from "@/components/lightning-payment";
import { formatCurrency, formatDate } from "@/lib/format";
import { type ApiEnvelope, type Order } from "@/lib/types";

const STATUS_FLOW = [
  { key: "pending", label: "Pending", color: "bg-yellow-500", textColor: "text-yellow-700", bgLight: "bg-yellow-100" },
  { key: "confirmed", label: "Confirmed", color: "bg-blue-500", textColor: "text-blue-700", bgLight: "bg-blue-100" },
  { key: "in_production", label: "In Production", color: "bg-purple-500", textColor: "text-purple-700", bgLight: "bg-purple-100" },
  { key: "ready_to_ship", label: "Ready to Ship", color: "bg-indigo-500", textColor: "text-indigo-700", bgLight: "bg-indigo-100" },
  { key: "shipped", label: "Shipped", color: "bg-cyan-500", textColor: "text-cyan-700", bgLight: "bg-cyan-100" },
  { key: "delivered", label: "Delivered", color: "bg-green-500", textColor: "text-green-700", bgLight: "bg-green-100" },
];

function StatusTracker({ currentStatus }: { currentStatus: string }) {
  const currentIndex = STATUS_FLOW.findIndex((s) => s.key === currentStatus);

  return (
    <div className="py-6">
      {/* Desktop horizontal flow */}
      <div className="hidden sm:flex items-start justify-between">
        {STATUS_FLOW.map((step, index) => {
          const isReached = index <= currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <div key={step.key} className="flex flex-1 flex-col items-center relative">
              {/* Connector line */}
              {index > 0 && (
                <div
                  className={`absolute top-4 right-1/2 w-full h-1 -translate-y-1/2 ${
                    isReached ? step.color : "bg-neutral-200"
                  }`}
                  style={{ zIndex: 0 }}
                />
              )}
              {/* Circle */}
              <div
                className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold ${
                  isCurrent
                    ? `${step.color} border-transparent text-white ring-4 ring-opacity-30 ${step.bgLight.replace("bg-", "ring-")}`
                    : isReached
                    ? `${step.color} border-transparent text-white`
                    : "bg-white border-neutral-300 text-neutral-400"
                }`}
              >
                {isReached ? "✓" : index + 1}
              </div>
              <p
                className={`mt-2 text-center text-xs font-medium leading-tight ${
                  isCurrent ? step.textColor + " font-bold" : isReached ? "text-neutral-700" : "text-neutral-400"
                }`}
              >
                {step.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Mobile vertical flow */}
      <div className="sm:hidden space-y-0">
        {STATUS_FLOW.map((step, index) => {
          const isReached = index <= currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <div key={step.key} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isCurrent
                      ? `${step.color} text-white ring-4 ring-opacity-30 ${step.bgLight.replace("bg-", "ring-")}`
                      : isReached
                      ? `${step.color} text-white`
                      : "bg-neutral-200 text-neutral-400"
                  }`}
                >
                  {isReached ? "✓" : index + 1}
                </div>
                {index < STATUS_FLOW.length - 1 && (
                  <div className={`w-0.5 h-8 ${index < currentIndex ? STATUS_FLOW[index + 1].color : "bg-neutral-200"}`} />
                )}
              </div>
              <p
                className={`pt-1.5 text-sm ${
                  isCurrent ? step.textColor + " font-bold" : isReached ? "text-neutral-700 font-medium" : "text-neutral-400"
                }`}
              >
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StarSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <span className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="focus:outline-none"
        >
          <svg
            viewBox="0 0 20 20"
            className={`h-7 w-7 transition-colors ${
              star <= (hover || value) ? "fill-yellow-400 text-yellow-400" : "fill-neutral-200 text-neutral-200"
            }`}
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.539 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.783.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
          </svg>
        </button>
      ))}
    </span>
  );
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          viewBox="0 0 20 20"
          className={`h-5 w-5 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "fill-neutral-200 text-neutral-200"}`}
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.539 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.783.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
        </svg>
      ))}
    </span>
  );
}

type ExistingRating = {
  id: number;
  rating: number;
  review_text: string | null;
  customer_name: string;
  created_at: string;
};

function RatingSection({ orderNumber, phone }: { orderNumber: string; phone: string }) {
  const [existingRating, setExistingRating] = useState<ExistingRating | null | undefined>(undefined);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function fetchRating() {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/rating`, { cache: "no-store" });
        const payload = (await res.json()) as ApiEnvelope<ExistingRating | null>;
        if (res.ok && payload.success) {
          setExistingRating(payload.data ?? null);
        } else {
          setExistingRating(null);
        }
      } catch {
        setExistingRating(null);
      }
    }
    fetchRating();
  }, [orderNumber]);

  async function handleSubmit() {
    if (rating === 0) {
      setRatingError("Please select a rating.");
      return;
    }
    setSubmitting(true);
    setRatingError(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/rating`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(phone ? { "x-customer-phone": phone } : {}),
        },
        body: JSON.stringify({ rating, reviewText: reviewText.trim() || undefined }),
      });
      const payload = (await res.json()) as ApiEnvelope<unknown>;
      if (!res.ok || !payload.success) {
        const msg = !payload.success ? payload.error?.message || "Failed to submit" : "Failed to submit";
        throw new Error(msg);
      }
      setSubmitted(true);
    } catch (err) {
      setRatingError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  if (existingRating === undefined) return null;

  if (existingRating || submitted) {
    return (
      <div className="border-t border-neutral-200 pt-4">
        <p className="text-xs font-semibold uppercase text-neutral-500 mb-2">Your Rating</p>
        <div className="flex items-center gap-2">
          <StarDisplay rating={existingRating?.rating ?? rating} />
          <span className="text-sm font-medium text-neutral-700">{existingRating?.rating ?? rating}/5</span>
        </div>
        {(existingRating?.review_text || reviewText) && (
          <p className="mt-2 text-sm text-neutral-600 italic">&ldquo;{existingRating?.review_text || reviewText}&rdquo;</p>
        )}
        <p className="mt-1 text-xs text-green-600">Thank you for your feedback!</p>
      </div>
    );
  }

  return (
    <div className="border-t border-neutral-200 pt-4">
      <p className="text-xs font-semibold uppercase text-neutral-500 mb-3">Rate Your Order</p>
      <div className="space-y-3">
        <div>
          <p className="text-sm text-neutral-600 mb-1">How would you rate your experience?</p>
          <StarSelector value={rating} onChange={setRating} />
        </div>
        <Textarea
          placeholder="Share your experience (optional)"
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          maxLength={500}
          rows={3}
        />
        {ratingError && <p className="text-sm text-red-600">{ratingError}</p>}
        <Button onClick={handleSubmit} disabled={submitting} size="sm">
          {submitting ? "Submitting..." : "Submit Rating"}
        </Button>
      </div>
    </div>
  );
}

function canCancelOrder(order: Order): boolean {
  return order.status === "pending";
}

function TrackOrderContent() {
  const searchParams = useSearchParams();
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [statusJustChanged, setStatusJustChanged] = useState(false);

  const handleTrack = useCallback(async (num?: string, prefilledPhone?: string) => {
    const target = (num ?? orderNumber).trim();
    if (!target) return;

    const phoneToUse = (prefilledPhone ?? phone).trim();
    if (!phoneToUse) {
      setError("Please enter your phone number to verify your order.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(target)}`, {
        cache: "no-store",
        headers: { "x-customer-phone": phoneToUse },
      });
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
  }, [orderNumber, phone]);

  // Poll for real-time status updates every 5 seconds when an order is displayed
  useEffect(() => {
    if (!order || !phone) return;

    const terminal = ["delivered", "cancelled", "payment_failed"];
    if (terminal.includes(order.status)) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(order.order_number)}`, {
          cache: "no-store",
          headers: { "x-customer-phone": phone },
        });
        const payload = (await res.json()) as ApiEnvelope<Order>;
        if (res.ok && payload.success) {
          const updated = payload.data as Order;
          if (updated.status !== order.status) {
            setOrder(updated);
            setStatusJustChanged(true);
            setTimeout(() => setStatusJustChanged(false), 3000);
          }
        }
      } catch {
        // ignore polling errors silently
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [order, phone]);

  async function handleCancel() {
    if (!order) return;
    if (!confirm("Are you sure you want to cancel this order? This cannot be undone.")) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(order.order_number)}/cancel`, {
        method: "POST",
        headers: { "x-customer-phone": phone },
      });
      const payload = (await res.json()) as ApiEnvelope<unknown>;
      if (!res.ok || !payload.success) {
        const msg = !payload.success ? payload.error?.message || "Failed to cancel order" : "Failed to cancel order";
        throw new Error(msg);
      }
      // Refresh order to show updated status
      await handleTrack(order.order_number, phone);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Failed to cancel order");
    } finally {
      setCancelling(false);
    }
  }

  // Pre-fill from URL query params (?id= or ?orderNumber=) — also restore stored phone
  useEffect(() => {
    const fromUrl = searchParams.get("id") || searchParams.get("orderNumber");
    if (fromUrl) {
      setOrderNumber(fromUrl);
      try {
        const stored = JSON.parse(sessionStorage.getItem(`ca_order_${fromUrl}`) ?? "{}");
        if (stored.phone) {
          setPhone(stored.phone);
          handleTrack(fromUrl, stored.phone);
        }
        // No stored phone — pre-fill order number only, wait for user to enter phone manually
      } catch {
        // ignore storage errors
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <AnimatedPage>
      <section className="mx-auto w-full max-w-3xl px-6 py-14">
        <h1 className="text-4xl font-semibold text-neutral-900">Track Your Order</h1>
        <p className="mt-3 text-neutral-600">Enter your order number and phone number to view live order progress.</p>

        <div className="mt-8 space-y-3">
          <Input
            value={orderNumber}
            onChange={(event) => setOrderNumber(event.target.value)}
            placeholder="Order number (e.g. CO-20260325-AB12CD34)"
            onKeyDown={(e) => { if (e.key === "Enter") handleTrack(); }}
          />
          <div className="flex gap-3">
            <Input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Phone number used when ordering"
              type="tel"
              onKeyDown={(e) => { if (e.key === "Enter") handleTrack(); }}
              className="flex-1"
            />
            <Button onClick={() => handleTrack()} disabled={loading}>
              {loading ? "Checking..." : "Track"}
            </Button>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        {order ? (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>{order.order_number}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {statusJustChanged && (
                <div className="rounded-md bg-green-50 border border-green-200 px-4 py-2 text-sm font-medium text-green-700 animate-pulse">
                  Order status updated!
                </div>
              )}
              {order.status === "payment_failed" ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="mt-4 text-xl font-bold text-red-600">Payment Failed!</p>
                  <p className="mt-1 text-sm text-neutral-500">Your payment could not be verified. Please contact support.</p>
                </div>
              ) : order.status === "cancelled" ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="mt-4 text-xl font-bold text-red-600">Order Cancelled</p>
                </div>
              ) : (
                <StatusTracker currentStatus={order.status} />
              )}

              <div className="grid gap-4 sm:grid-cols-2 text-sm text-neutral-700">
                <div>
                  <p className="text-xs font-medium text-neutral-500">Customer</p>
                  <p className="font-medium text-neutral-900">{order.customer_name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500">Total</p>
                  <p className="font-semibold text-neutral-900">{formatCurrency(order.total_cents)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500">Placed</p>
                  <p>{formatDate(order.placed_at)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500">Current Status</p>
                  <p className="font-semibold capitalize">{order.status.replace(/_/g, " ")}</p>
                </div>
              </div>

              {/* Order Items */}
              {order.items.length > 0 && (
                <div className="border-t border-neutral-200 pt-4">
                  <p className="text-xs font-semibold uppercase text-neutral-500 mb-2">Items</p>
                  {order.items.map((item) => {
                    const itemCustomizations = (order.customizations ?? []).filter(
                      (c) => c.order_item_id === item.id
                    );
                    return (
                      <div key={item.id} className="py-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-700">{item.product_name_snapshot} × {item.quantity}</span>
                          <span className="font-medium">{formatCurrency(item.line_total_cents)}</span>
                        </div>
                        {itemCustomizations.length > 0 && (
                          <div className="mt-1 rounded-md bg-neutral-50 px-2 py-1 text-xs">
                            {itemCustomizations.map((c) => (
                              <div key={c.id} className="flex justify-between py-0.5">
                                <span className="text-neutral-500">{c.field_name}</span>
                                <span className="text-neutral-700">{c.field_value}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Status History */}
              {(order.history ?? []).length > 1 && (
                <div className="border-t border-neutral-200 pt-4">
                  <p className="text-xs font-semibold uppercase text-neutral-500 mb-2">Status History</p>
                  <div className="space-y-1.5">
                    {[...(order.history ?? [])].reverse().map((log) => (
                      <div key={log.id} className="flex items-start gap-2 text-xs">
                        <span className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-neutral-300" />
                        <div>
                          <span className="font-medium text-neutral-800 capitalize">
                            {log.new_status.replace(/_/g, " ")}
                          </span>
                          {log.previous_status && (
                            <span className="text-neutral-500"> (from {log.previous_status.replace(/_/g, " ")})</span>
                          )}
                          <span className="ml-1 text-neutral-400">{formatDate(log.changed_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lightning Payment — for pending orders with Bitcoin Lightning */}
              {(order.customizations ?? []).some(
                (c) => c.field_name === "paymentMethod" && c.field_value === "Pay with Bitcoin Lightning"
              ) && order.status === "pending" && (
                <LightningPayment
                  orderNumber={order.order_number}
                  totalCents={order.total_cents}
                  phone={phone}
                />
              )}

              {/* Cancel Order — only when status is pending */}
              {canCancelOrder(order) && (
                <div className="border-t border-neutral-200 pt-4">
                  <p className="text-xs font-semibold uppercase text-neutral-500 mb-2">Cancel Order</p>
                  <p className="mb-3 text-sm text-neutral-600">
                    Your order is pending and can be cancelled.
                  </p>
                  {cancelError && <p className="mb-2 text-sm text-red-600">{cancelError}</p>}
                  <Button
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50"
                    onClick={handleCancel}
                    disabled={cancelling}
                  >
                    {cancelling ? "Cancelling..." : "Cancel Order"}
                  </Button>
                </div>
              )}

              {/* Rating Section — only for delivered orders */}
              {order.status === "delivered" && (
                <RatingSection orderNumber={order.order_number} phone={phone} />
              )}
            </CardContent>
          </Card>
        ) : null}
      </section>
    </AnimatedPage>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense>
      <TrackOrderContent />
    </Suspense>
  );
}
