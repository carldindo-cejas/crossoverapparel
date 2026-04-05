"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { AnimatedPage } from "@/components/site/animated-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LightningPayment } from "@/components/lightning-payment";
import { InstaPayPayment } from "@/components/instapay-payment";
import { type ApiEnvelope, type Product, type Category } from "@/lib/types";
import { useApi } from "@/hooks/use-api";
import { formatCurrency } from "@/lib/format";

/* ── Types ── */
type PaymentMethod = { id: number; name: string; is_available: number };

type OrderSummary = {
  orderNumber: string;
  status: string;
  customerName: string;
  phone: string;
  mapLocation: string;
  productLabel: string;
  quantity: number;
  paymentMethod: string;
  deadline: string;
  unitPriceCents: number;
  totalCents: number;
};

type FormState = {
  name: string;
  phone: string;
  quantity: string;
  deadlineDate: string;
  paymentMethod: string;
  mapLat: string;
  mapLng: string;
};

const initialForm: FormState = {
  name: "",
  phone: "",
  quantity: "1",
  deadlineDate: "",
  paymentMethod: "Cash on Delivery",
  mapLat: "",
  mapLng: "",
};

/* ── Page ── */
export default function ExclusiveOrderPage() {
  const params = useParams<{ productId: string }>();
  const productId = Number(params.productId);

  const { data: products } = useApi<Product[]>("/api/products");
  const { data: categories } = useApi<Category[]>("/api/categories");
  const { data: paymentMethods } = useApi<PaymentMethod[]>("/api/payment-methods");

  const product = useMemo(
    () => (products || []).find((p) => p.id === productId) ?? null,
    [products, productId]
  );

  const isExclusive = useMemo(() => {
    if (!product || !categories) return false;
    const cat = categories.find((c) => c.id === product.category_id);
    return cat?.name?.toLowerCase().includes("exclusive") ?? false;
  }, [product, categories]);

  const productLabel = product ? `${product.sku} — ${product.name}` : "";
  const unitPriceCents = product?.base_price_cents ?? 0;

  /* ── Form state ── */
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [orderSummary, setOrderSummary] = useState<OrderSummary | null>(null);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const quantity = Math.max(1, parseInt(form.quantity, 10) || 1);
  const totalCents = unitPriceCents * quantity;

  /* ── Validation ── */
  function validate(): string | null {
    if (!product) return "Product not found";
    if (!form.name.trim()) return "Name is required";
    if (!form.phone.trim()) return "Phone is required";
    if (!form.quantity || quantity < 1) return "Quantity must be at least 1";
    if (!form.mapLat.trim() || !form.mapLng.trim()) return "Map pin location is required";
    if (!form.deadlineDate) return "Deadline date is required";
    const minDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    minDeadline.setHours(0, 0, 0, 0);
    if (new Date(form.deadlineDate + "T00:00:00") < minDeadline)
      return "Deadline must be at least 7 days from today";
    return null;
  }

  /* ── Submit ── */
  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);

    try {
      const customerName = form.name.trim();
      const segments = customerName.split(" ");
      const firstName = segments[0] || customerName;
      const lastName = segments.slice(1).join(" ") || "Customer";

      const deadline = form.deadlineDate;
      const locationValue = `${form.mapLat},${form.mapLng}`;

      const orderPayload = {
        customer: {
          firstName,
          lastName,
          email: `${form.phone.replace(/[^0-9]/g, "")}@guest.crossover.local`,
          phone: form.phone,
          shippingAddress: { fullAddress: locationValue, lat: form.mapLat, lng: form.mapLng },
          billingAddress: { fullAddress: locationValue },
        },
        items: [
          {
            productId: product!.id,
            quantity,
            customizations: [
              { customizationType: "other" as const, fieldName: "deadline", fieldValue: deadline, additionalCostCents: 0 },
              { customizationType: "other" as const, fieldName: "paymentMethod", fieldValue: form.paymentMethod, additionalCostCents: 0 },
              { customizationType: "other" as const, fieldName: "mapLocation", fieldValue: locationValue, additionalCostCents: 0 },
            ],
          },
        ],
        notes: `Exclusive order — ${productLabel}`,
      };

      const orderResponse = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });

      const orderResult = (await orderResponse.json()) as ApiEnvelope<{
        orderId: string;
        orderNumber: string;
      }>;

      if (!orderResponse.ok || !orderResult.success) {
        const message = !orderResult.success
          ? orderResult.error?.message || "Unable to create order"
          : "Unable to create order";
        throw new Error(message);
      }

      const createdOrderNumber = orderResult.data.orderNumber;

      try {
        sessionStorage.setItem(
          `ca_order_${createdOrderNumber}`,
          JSON.stringify({ phone: form.phone.trim() })
        );
      } catch { /* sessionStorage unavailable */ }

      setOrderNumber(createdOrderNumber);
      setOrderSummary({
        orderNumber: createdOrderNumber,
        status: "pending",
        customerName: form.name.trim(),
        phone: form.phone.trim(),
        mapLocation: `${form.mapLat}, ${form.mapLng}`,
        productLabel,
        quantity,
        paymentMethod: form.paymentMethod,
        deadline: form.deadlineDate,
        unitPriceCents,
        totalCents,
      });
      setForm(initialForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Not found / not exclusive guard ── */
  if (products && !product) {
    return (
      <AnimatedPage>
        <section className="mx-auto w-full max-w-4xl px-6 py-14 text-center">
          <h1 className="text-3xl font-semibold text-neutral-900">Product Not Found</h1>
          <p className="mt-3 text-neutral-600">
            The product you&apos;re looking for doesn&apos;t exist or is no longer available.
          </p>
          <Link href="/">
            <Button className="mt-6">Back to Home</Button>
          </Link>
        </section>
      </AnimatedPage>
    );
  }

  if (products && categories && product && !isExclusive) {
    return (
      <AnimatedPage>
        <section className="mx-auto w-full max-w-4xl px-6 py-14 text-center">
          <h1 className="text-3xl font-semibold text-neutral-900">Not an Exclusive Product</h1>
          <p className="mt-3 text-neutral-600">
            This product is not in the exclusive category. Please use the regular order form.
          </p>
          <Link href={`/product-order/${productId}`}>
            <Button className="mt-6">Go to Regular Order</Button>
          </Link>
        </section>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <section className="mx-auto w-full max-w-4xl px-6 py-14">
        {/* ── Product Preview ── */}
        {product && (
          <div className="mb-8 overflow-hidden rounded-2xl border border-neutral-200 bg-white md:flex">
            <div className="relative aspect-[4/5] w-full bg-neutral-100 md:w-80">
              {product.image_url ? (
                <Image
                  src={`/api/products/images/${product.image_url}`}
                  alt={product.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200">
                  <span className="text-6xl text-neutral-300">📷</span>
                </div>
              )}
            </div>
            <div className="flex flex-col justify-center gap-3 p-6">
              <span className="inline-block w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-700">
                Exclusive
              </span>
              <h1 className="text-2xl font-semibold text-neutral-900">
                {product.sku} — {product.name}
              </h1>
              <p className="text-xl font-bold text-neutral-900">
                {formatCurrency(unitPriceCents, product.currency)}
              </p>
              {product.description && (
                <p className="max-w-md text-sm text-neutral-600">{product.description}</p>
              )}
            </div>
          </div>
        )}

        {/* ── Order Success Summary ── */}
        {orderNumber && orderSummary && (
          <Card className="mt-6 border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="text-green-800">Order Submitted Successfully!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase text-neutral-500">Tracking ID</p>
                  <p className="text-lg font-bold text-neutral-900">{orderSummary.orderNumber}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase text-neutral-500">Status</p>
                  <span className="inline-block rounded-full bg-yellow-100 px-3 py-1 text-sm font-semibold text-yellow-800">
                    {orderSummary.status}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase text-neutral-500">Product</p>
                  <p className="text-sm text-neutral-900">{orderSummary.productLabel}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase text-neutral-500">Customer</p>
                  <p className="text-sm text-neutral-900">{orderSummary.customerName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase text-neutral-500">Phone</p>
                  <p className="text-sm text-neutral-900">{orderSummary.phone}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase text-neutral-500">Quantity</p>
                  <p className="text-sm text-neutral-900">{orderSummary.quantity}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase text-neutral-500">Payment Method</p>
                  <p className="text-sm text-neutral-900">{orderSummary.paymentMethod}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase text-neutral-500">Deadline</p>
                  <p className="text-sm text-neutral-900">{orderSummary.deadline}</p>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <p className="text-xs font-medium uppercase text-neutral-500">Delivery Location</p>
                  <p className="text-sm text-neutral-900">{orderSummary.mapLocation}</p>
                </div>
                <div className="space-y-2 md:col-span-2 rounded-lg border border-green-200 bg-white p-4">
                  <div className="flex justify-between text-sm text-neutral-700">
                    <span>Price per unit</span>
                    <span>{formatCurrency(orderSummary.unitPriceCents)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-neutral-700">
                    <span>Quantity</span>
                    <span>{orderSummary.quantity}</span>
                  </div>
                  <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-bold text-neutral-900">
                    <span>Total Payable</span>
                    <span>{formatCurrency(orderSummary.totalCents)}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Link href={`/order-summary/${orderSummary.orderNumber}`}>
                  <Button variant="outline" size="sm">View Full Order</Button>
                </Link>
                <Link href={`/track-order?id=${orderSummary.orderNumber}`}>
                  <Button variant="outline" size="sm">Track Order</Button>
                </Link>
              </div>

              {orderSummary.paymentMethod === "Pay with Bitcoin Lightning" && (
                <LightningPayment
                  orderNumber={orderSummary.orderNumber}
                  totalCents={orderSummary.totalCents}
                  phone={orderSummary.phone}
                />
              )}
              {orderSummary.paymentMethod === "Instapay" && (
                <InstaPayPayment
                  orderNumber={orderSummary.orderNumber}
                  totalCents={orderSummary.totalCents}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Order Form ── */}
        {!orderNumber && product && (
          <Card>
            <CardHeader>
              <CardTitle>Exclusive Order</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid gap-6" onSubmit={submitOrder}>
                {/* Customer Details */}
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) => updateField("name", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone *</Label>
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Quantity */}
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={(e) => updateField("quantity", e.target.value)}
                    required
                  />
                </div>

                {/* Deadline */}
                <div className="space-y-2">
                  <Label htmlFor="deadlineDate">Deadline Date *</Label>
                  <Input
                    id="deadlineDate"
                    type="date"
                    min={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" })}
                    value={form.deadlineDate}
                    onChange={(e) => updateField("deadlineDate", e.target.value)}
                    required
                  />
                </div>

                {/* Payment Method */}
                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Payment Method *</Label>
                  <select
                    id="paymentMethod"
                    className="flex h-10 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm"
                    value={form.paymentMethod}
                    onChange={(e) => updateField("paymentMethod", e.target.value)}
                  >
                    {(paymentMethods || []).map((pm) => (
                      <option key={pm.id} value={pm.name} disabled={pm.is_available !== 1}>
                        {pm.name}
                        {pm.is_available !== 1 ? " (Unavailable)" : ""}
                      </option>
                    ))}
                    {!paymentMethods && (
                      <>
                        <option>Cash on Delivery</option>
                        <option disabled>Instapay (Unavailable)</option>
                        <option disabled>Bank Transfer (Unavailable)</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Pricing Summary */}
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-neutral-700">Order Pricing</h3>
                  <div className="flex justify-between text-sm text-neutral-600">
                    <span>Product</span>
                    <span>{productLabel}</span>
                  </div>
                  <div className="flex justify-between text-sm text-neutral-600">
                    <span>Price per unit</span>
                    <span>{formatCurrency(unitPriceCents)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-neutral-600">
                    <span>Quantity</span>
                    <span>{quantity}</span>
                  </div>
                  <div className="flex justify-between border-t border-neutral-300 pt-2 text-base font-bold text-neutral-900">
                    <span>Total Payable</span>
                    <span>{formatCurrency(totalCents)}</span>
                  </div>
                </div>

                {/* Map Pin Location */}
                <fieldset className="space-y-4 rounded-xl border border-neutral-200 p-4">
                  <legend className="px-2 text-sm font-semibold text-neutral-700">
                    Map Pin Location *
                  </legend>
                  <p className="text-xs text-neutral-500">
                    Click the map to set your delivery pin, or enter coordinates manually.
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Latitude</Label>
                      <Input
                        value={form.mapLat}
                        onChange={(e) => updateField("mapLat", e.target.value)}
                        placeholder="e.g. 9.3068"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Longitude</Label>
                      <Input
                        value={form.mapLng}
                        onChange={(e) => updateField("mapLng", e.target.value)}
                        placeholder="e.g. 123.8854"
                      />
                    </div>
                  </div>
                  <MapLoader
                    lat={form.mapLat}
                    lng={form.mapLng}
                    onPick={(lat, lng) => {
                      updateField("mapLat", lat.toFixed(6));
                      updateField("mapLng", lng.toFixed(6));
                    }}
                  />
                </fieldset>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Submitting..." : "Place Order"}
                  </Button>
                  <Link href="/">
                    <Button type="button" variant="outline">
                      Back to Home
                    </Button>
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Loading state */}
        {!products && (
          <div className="py-20 text-center text-neutral-500">Loading product…</div>
        )}
      </section>
    </AnimatedPage>
  );
}

/* ── Leaflet map loader ── */
function MapLoader({
  lat,
  lng,
  onPick,
}: {
  lat: string;
  lng: string;
  onPick: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    const defaultLat = lat ? Number(lat) : 9.3068;
    const defaultLng = lng ? Number(lng) : 123.8854;

    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => {
      try {
        const L = (window as any).L;
        if (!L || !containerRef.current) return;

        const map = L.map(containerRef.current).setView([defaultLat, defaultLng], 13);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map);

        mapRef.current = map;

        function placeMarker(latlng: any) {
          if (markerRef.current) markerRef.current.setLatLng(latlng);
          else markerRef.current = L.marker(latlng).addTo(map);
          onPick(latlng.lat, latlng.lng);
        }

        map.on("click", (e: any) => placeMarker(e.latlng));

        if (lat && lng) {
          const initLatLng = { lat: Number(lat), lng: Number(lng) };
          placeMarker(initLatLng);
        }
      } catch {
        /* Leaflet init error — ignore gracefully */
      }
    };

    document.body.appendChild(script);

    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {
          /* ignore */
        }
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-72 w-full rounded-lg border border-neutral-200"
      style={{ zIndex: 0 }}
    />
  );
}
