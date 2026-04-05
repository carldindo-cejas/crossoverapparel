"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatedPage } from "@/components/site/animated-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LightningPayment } from "@/components/lightning-payment";
import { type ApiEnvelope, type Product, type Category } from "@/lib/types";
import { useApi } from "@/hooks/use-api";
import { formatCurrency } from "@/lib/format";

const PRODUCT_TYPES = ["Jersey", "Tshirt", "Poloshirt", "Warmer"] as const;

// Fixed pricing per product type (in centavos)
const PRICE_MAP: Record<string, number> = {
  Jersey: 34900,
  Tshirt: 39900,
  Poloshirt: 44900,
  Warmer: 54900,
};

type PaymentMethod = {
  id: number;
  name: string;
  is_available: number;
};

type OrderSummary = {
  orderNumber: string;
  status: string;
  customerName: string;
  phone: string;
  mapLocation: string;
  teamName: string;
  productType: string;
  cuttingFront: string;
  cuttingBack: string;
  cuttingBelow: string;
  paymentMethod: string;
  deadline: string;
  players: { size: string; number: string; surname: string }[];
  instructions: string;
  unitPriceCents: number;
  totalCents: number;
};

const SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"] as const;

type Player = {
  id: number;
  size: string;
  number: string;
  surname: string;
};

type FormState = {
  name: string;
  phone: string;
  productId: string;
  productType: string;
  teamName: string;
  cuttingFront: string;
  cuttingBack: string;
  cuttingBelow: string;
  otherInstructions: string;
  deadlineDate: string;
  deadlineTime: string;
  paymentMethod: string;
  mapLat: string;
  mapLng: string;
};

const initialForm: FormState = {
  name: "",
  phone: "",
  productId: "",
  productType: "",
  teamName: "",
  cuttingFront: "Round Neck",
  cuttingBack: "Normal Cut",
  cuttingBelow: "Straight Cut",
  otherInstructions: "",
  deadlineDate: "",
  deadlineTime: "",
  paymentMethod: "Cash on Delivery",
  mapLat: "",
  mapLng: "",
};

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

function fileErr(file: File | null): string | null {
  if (!file) return null;
  if (file.size > MAX_FILE_SIZE_BYTES)
    return `File exceeds 2MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB)`;
  return null;
}

export default function CustomOrderPage() {
  return (
    <Suspense>
      <CustomOrderContent />
    </Suspense>
  );
}

function CustomOrderContent() {
  const searchParams = useSearchParams();
  const { data: products } = useApi<Product[]>("/api/products");
  const { data: categories } = useApi<Category[]>("/api/categories");
  const { data: paymentMethods } = useApi<PaymentMethod[]>("/api/payment-methods");
  const [form, setForm] = useState<FormState>(initialForm);
  const [fromCollection, setFromCollection] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [leftLogo, setLeftLogo] = useState<File | null>(null);
  const [rightLogo, setRightLogo] = useState<File | null>(null);
  const [backLogo, setBackLogo] = useState<File | null>(null);
  const [players, setPlayers] = useState<Player[]>([
    { id: 1, size: "M", number: "", surname: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [orderSummary, setOrderSummary] = useState<OrderSummary | null>(null);

  // Map category name → product type
  function categoryToProductType(categoryName: string | null | undefined): string {
    if (!categoryName) return "";
    const lower = categoryName.toLowerCase();
    if (lower.includes("jersey") || lower.includes("sando")) return "Jersey";
    if (lower.includes("tshirt") || lower.includes("t-shirt")) return "Tshirt";
    if (lower.includes("polo")) return "Poloshirt";
    if (lower.includes("warmer")) return "Warmer";
    return "";
  }

  // Auto-assign product + type from URL query param
  useEffect(() => {
    const urlProductId = searchParams.get("productId");
    if (urlProductId && products && categories) {
      const product = products.find((p) => p.id === Number(urlProductId));
      if (product) {
        const cat = (categories || []).find((c) => c.id === product.category_id);
        const autoType = categoryToProductType(cat?.name);
        setForm((prev) => ({
          ...prev,
          productId: String(product.id),
          productType: autoType || prev.productType,
        }));
        setFromCollection(true);
      }
    }
  }, [searchParams, products, categories]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Player list helpers
  function addPlayer() {
    setPlayers((prev) => [
      ...prev,
      { id: Date.now(), size: "M", number: "", surname: "" },
    ]);
  }

  function removePlayer(id: number) {
    setPlayers((prev) => (prev.length > 1 ? prev.filter((p) => p.id !== id) : prev));
  }

  function updatePlayer(id: number, field: keyof Omit<Player, "id">, value: string) {
    setPlayers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  }

  // Sort players smallest → biggest
  const sortedPlayers = useMemo(() => {
    return [...players].sort(
      (a, b) => SIZES.indexOf(a.size as any) - SIZES.indexOf(b.size as any)
    );
  }, [players]);

  // Computed pricing
  const unitPriceCents = PRICE_MAP[form.productType] || 0;
  const totalPlayers = players.length;
  const totalCents = unitPriceCents * totalPlayers;

  function validate(): string | null {
    if (!form.name.trim()) return "Name is required";
    if (!form.phone.trim()) return "Phone is required";
    if (!form.mapLat.trim() || !form.mapLng.trim()) return "Map pin location is required";
    if (!form.productType) return "Product type is required";
    if (!form.teamName.trim()) return "Team name is required";
    if (!form.deadlineDate) return "Deadline date is required";
    if (!form.deadlineTime) return "Deadline time is required";
    const _minDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    _minDeadline.setHours(0, 0, 0, 0);
    if (new Date(form.deadlineDate + "T00:00:00") < _minDeadline) return "Deadline must be at least 7 days from today";
    if (form.deadlineTime < "08:00" || form.deadlineTime > "17:00") return "Deadline time must be between 8:00 AM and 5:00 PM";
    if (fileErr(photoFile)) return fileErr(photoFile)!;
    if (fileErr(leftLogo)) return `Left logo: ${fileErr(leftLogo)}`;
    if (fileErr(rightLogo)) return `Right logo: ${fileErr(rightLogo)}`;
    if (fileErr(backLogo)) return `Back logo: ${fileErr(backLogo)}`;
    for (const p of players) {
      if (!p.surname.trim()) return "Each player needs a surname";
      if (!p.number.trim()) return "Each player needs a number";
    }
    return null;
  }

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
      const lastName = segments.slice(1).join(" ") || "-Custom Order";

      const playerListValue = sortedPlayers
        .map((p) => `${p.surname} #${p.number} (${p.size})`)
        .join("; ");

      const deadline = `${form.deadlineDate}T${form.deadlineTime}`;

      const locationValue = `${form.mapLat},${form.mapLng}`;

      const activeProds = (products || []).filter((p) => p.status === "active");
      const selectedProductId = form.productId
        ? Number(form.productId)
        : activeProds[0]?.id;
      if (!selectedProductId) throw new Error("No products available. Please try again later.");

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
            productId: selectedProductId,
            quantity: totalPlayers,
            customizations: [
              { customizationType: "text", fieldName: "teamName", fieldValue: form.teamName, additionalCostCents: 0 },
              { customizationType: "text", fieldName: "productType", fieldValue: form.productType, additionalCostCents: 0 },
              { customizationType: "text", fieldName: "cuttingFront", fieldValue: form.cuttingFront, additionalCostCents: 0 },
              { customizationType: "text", fieldName: "cuttingBack", fieldValue: form.cuttingBack, additionalCostCents: 0 },
              { customizationType: "text", fieldName: "cuttingBelow", fieldValue: form.cuttingBelow, additionalCostCents: 0 },
              { customizationType: "text", fieldName: "playerList", fieldValue: playerListValue, additionalCostCents: 0 },
              { customizationType: "other", fieldName: "otherInstructions", fieldValue: form.otherInstructions || "N/A", additionalCostCents: 0 },
              { customizationType: "other", fieldName: "deadline", fieldValue: deadline, additionalCostCents: 0 },
              { customizationType: "other", fieldName: "paymentMethod", fieldValue: form.paymentMethod, additionalCostCents: 0 },
              { customizationType: "other", fieldName: "mapLocation", fieldValue: locationValue, additionalCostCents: 0 },
            ],
          },
        ],
        notes: `Custom order for ${form.teamName}`,
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

      const orderId = orderResult.data.orderId;
      const createdOrderNumber = orderResult.data.orderNumber;

      // Persist phone so order-summary / receipt / track-order can verify with the API
      try {
        sessionStorage.setItem(
          `ca_order_${createdOrderNumber}`,
          JSON.stringify({ phone: form.phone.trim() })
        );
      } catch { /* sessionStorage unavailable */ }

      // Upload all files with descriptive labels
      const LABEL_MAP: Record<string, string> = {
        photo: "[Product Photo]",
        leftLogo: "[Logo Left]",
        rightLogo: "[Logo Right]",
        backLogo: "[Logo Back]",
      };
      const filesToUpload: { file: File; label: string }[] = [];
      if (photoFile) filesToUpload.push({ file: photoFile, label: "photo" });
      if (leftLogo) filesToUpload.push({ file: leftLogo, label: "leftLogo" });
      if (rightLogo) filesToUpload.push({ file: rightLogo, label: "rightLogo" });
      if (backLogo) filesToUpload.push({ file: backLogo, label: "backLogo" });

      for (const { file, label } of filesToUpload) {
        const labeledFile = new File([file], `${LABEL_MAP[label]} ${file.name}`, { type: file.type });
        const uploadData = new FormData();
        uploadData.append("file", labeledFile);
        uploadData.append("orderId", orderId);

        await fetch("/api/uploads", {
          method: "POST",
          body: uploadData,
        });
      }

      setOrderNumber(createdOrderNumber);
      setOrderSummary({
        orderNumber: createdOrderNumber,
        status: "pending",
        customerName: form.name.trim(),
        phone: form.phone.trim(),
        mapLocation: `${form.mapLat}, ${form.mapLng}`,
        teamName: form.teamName.trim(),
        productType: form.productType,
        cuttingFront: form.cuttingFront,
        cuttingBack: form.cuttingBack,
        cuttingBelow: form.cuttingBelow,
        paymentMethod: form.paymentMethod,
        deadline: `${form.deadlineDate} ${form.deadlineTime}`,
        players: sortedPlayers.map((p) => ({ size: p.size, number: p.number, surname: p.surname })),
        instructions: form.otherInstructions.trim(),
        unitPriceCents,
        totalCents,
      });
      setForm(initialForm);
      setPhotoFile(null);
      setLeftLogo(null);
      setRightLogo(null);
      setBackLogo(null);
      setPlayers([{ id: 1, size: "M", number: "", surname: "" }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatedPage>
      <section className="mx-auto w-full max-w-4xl px-6 py-14">
        <h1 className="text-4xl font-semibold text-neutral-900">
          Custom Team Order
        </h1>
        <p className="mt-3 text-neutral-600">
          Submit full customization details. We will convert your request into
          production-ready specs.
        </p>

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
                  <p className="text-xs font-medium uppercase text-neutral-500">Customer</p>
                  <p className="text-sm text-neutral-900">{orderSummary.customerName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase text-neutral-500">Phone</p>
                  <p className="text-sm text-neutral-900">{orderSummary.phone}</p>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <p className="text-xs font-medium uppercase text-neutral-500">Delivery Location</p>
                  <p className="text-sm text-neutral-900">{orderSummary.mapLocation}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase text-neutral-500">Team Name</p>
                  <p className="text-sm text-neutral-900">{orderSummary.teamName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase text-neutral-500">Product Type</p>
                  <p className="text-sm text-neutral-900">{orderSummary.productType}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase text-neutral-500">Cutting Style</p>
                  <p className="text-sm text-neutral-900">
                    {orderSummary.cuttingFront} / {orderSummary.cuttingBack} / {orderSummary.cuttingBelow}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase text-neutral-500">Payment Method</p>
                  <p className="text-sm text-neutral-900">{orderSummary.paymentMethod}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase text-neutral-500">Deadline</p>
                  <p className="text-sm text-neutral-900">{orderSummary.deadline}</p>
                </div>
                {orderSummary.players.length > 0 && (
                  <div className="space-y-1 md:col-span-2">
                    <p className="text-xs font-medium uppercase text-neutral-500">Player List</p>
                    <div className="rounded-lg border border-neutral-200 bg-white">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-neutral-200 text-neutral-500">
                            <th className="px-3 py-2">Size</th>
                            <th className="px-3 py-2">#</th>
                            <th className="px-3 py-2">Surname</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orderSummary.players.map((p, i) => (
                            <tr key={i} className="border-b border-neutral-100 last:border-0">
                              <td className="px-3 py-2">{p.size}</td>
                              <td className="px-3 py-2">{p.number}</td>
                              <td className="px-3 py-2">{p.surname}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {orderSummary.instructions && (
                  <div className="space-y-1 md:col-span-2">
                    <p className="text-xs font-medium uppercase text-neutral-500">Other Instructions</p>
                    <p className="text-sm text-neutral-900">{orderSummary.instructions}</p>
                  </div>
                )}
                <div className="space-y-2 md:col-span-2 rounded-lg border border-green-200 bg-white p-4">
                  <div className="flex justify-between text-sm text-neutral-700">
                    <span>Price per unit ({orderSummary.productType})</span>
                    <span>{formatCurrency(orderSummary.unitPriceCents)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-neutral-700">
                    <span>Total players</span>
                    <span>{orderSummary.players.length}</span>
                  </div>
                  <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-bold text-neutral-900">
                    <span>Total Payable</span>
                    <span>{formatCurrency(orderSummary.totalCents)}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Link href={`/order-summary/${orderSummary.orderNumber}`}>
                  <Button variant="outline" size="sm">
                    View Full Order
                  </Button>
                </Link>
                <Link href={`/track-order?id=${orderSummary.orderNumber}`}>
                  <Button variant="outline" size="sm">
                    Track Order
                  </Button>
                </Link>
              </div>

              {orderSummary.paymentMethod === "Pay with Bitcoin Lightning" && (
                <LightningPayment
                  orderNumber={orderSummary.orderNumber}
                  totalCents={orderSummary.totalCents}
                  phone={orderSummary.phone}
                />
              )}
            </CardContent>
          </Card>
        )}

        {!orderNumber && <Card className="mt-8">
          <CardHeader>
            <CardTitle>Order Information</CardTitle>
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

              {/* Photo Attachment */}
              <div className="space-y-2">
                <Label htmlFor="photo">
                  Photo Attachment{" "}
                  <span className="text-xs text-neutral-400">(max 2MB)</span>
                </Label>
                <Input
                  id="photo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setPhotoFile(f);
                  }}
                />
                {photoFile && fileErr(photoFile) && (
                  <p className="text-xs text-red-600">{fileErr(photoFile)}</p>
                )}
              </div>

              {/* Product Type */}
              <div className="space-y-2">
                <Label htmlFor="productType">Product Type *</Label>
                <select
                  id="productType"
                  className="flex h-10 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm"
                  value={form.productType}
                  onChange={(e) => updateField("productType", e.target.value)}
                  required
                >
                  <option value="">Select product type</option>
                  {PRODUCT_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                {fromCollection && form.productType && (
                  <p className="text-xs text-neutral-500">Auto-assigned from product category</p>
                )}
              </div>

              {/* Cutting Styles */}
              <fieldset className="space-y-4 rounded-xl border border-neutral-200 p-4">
                <legend className="px-2 text-sm font-semibold text-neutral-700">
                  Cutting Styles
                </legend>
                <div className="grid gap-5 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="cuttingFront">Front</Label>
                    <select
                      id="cuttingFront"
                      className="flex h-10 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm"
                      value={form.cuttingFront}
                      onChange={(e) => updateField("cuttingFront", e.target.value)}
                    >
                      <option>Round Neck</option>
                      <option>V-Neck</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cuttingBack">Back</Label>
                    <select
                      id="cuttingBack"
                      className="flex h-10 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm"
                      value={form.cuttingBack}
                      onChange={(e) => updateField("cuttingBack", e.target.value)}
                    >
                      <option>Normal Cut</option>
                      <option>NBA Cut</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cuttingBelow">Below</Label>
                    <select
                      id="cuttingBelow"
                      className="flex h-10 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm"
                      value={form.cuttingBelow}
                      onChange={(e) => updateField("cuttingBelow", e.target.value)}
                    >
                      <option>Straight Cut</option>
                      <option>Amboy Cut</option>
                    </select>
                  </div>
                </div>
              </fieldset>

              {/* Team Name */}
              <div className="space-y-2">
                <Label htmlFor="teamName">Team Name *</Label>
                <Input
                  id="teamName"
                  value={form.teamName}
                  onChange={(e) => updateField("teamName", e.target.value)}
                  required
                />
              </div>

              {/* Quantity */}
              <div className="space-y-2">
                <Label>Quantity</Label>
                <div className="flex h-10 w-full items-center rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-700">
                  {players.length} {players.length === 1 ? "player" : "players"}
                </div>
              </div>

              {/* Player List */}
              <fieldset className="space-y-4 rounded-xl border border-neutral-200 p-4">
                <legend className="px-2 text-sm font-semibold text-neutral-700">
                  Player List
                </legend>
                <p className="text-xs text-neutral-500">
                  Players will be sorted by size (smallest → biggest).
                </p>
                <div className="space-y-3">
                  {players.map((player, idx) => (
                    <div
                      key={player.id}
                      className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-100 bg-neutral-50 p-3"
                    >
                      <div className="w-20 space-y-1">
                        <Label className="text-xs">Size</Label>
                        <select
                          className="flex h-9 w-full rounded-lg border border-neutral-300 bg-white px-2 text-sm"
                          value={player.size}
                          onChange={(e) =>
                            updatePlayer(player.id, "size", e.target.value)
                          }
                        >
                          {SIZES.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-20 space-y-1">
                        <Label className="text-xs">Number</Label>
                        <Input
                          className="h-9"
                          value={player.number}
                          onChange={(e) =>
                            updatePlayer(player.id, "number", e.target.value)
                          }
                          placeholder="#"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Surname</Label>
                        <Input
                          className="h-9"
                          value={player.surname}
                          onChange={(e) =>
                            updatePlayer(player.id, "surname", e.target.value)
                          }
                          placeholder="Last name"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 text-red-500"
                        onClick={() => removePlayer(player.id)}
                      >
                        ✕
                      </Button>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addPlayer}>
                  + Add Player
                </Button>
              </fieldset>

              {/* Logo Attachments */}
              <fieldset className="space-y-4 rounded-xl border border-neutral-200 p-4">
                <legend className="px-2 text-sm font-semibold text-neutral-700">
                  Logo Attachments{" "}
                  <span className="text-xs font-normal text-neutral-400">
                    (max 2MB each)
                  </span>
                </legend>
                <div className="grid gap-5 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="leftLogo">Left Logo</Label>
                    <Input
                      id="leftLogo"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setLeftLogo(e.target.files?.[0] || null)}
                    />
                    {leftLogo && fileErr(leftLogo) && (
                      <p className="text-xs text-red-600">
                        {fileErr(leftLogo)}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rightLogo">Right Logo</Label>
                    <Input
                      id="rightLogo"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setRightLogo(e.target.files?.[0] || null)}
                    />
                    {rightLogo && fileErr(rightLogo) && (
                      <p className="text-xs text-red-600">
                        {fileErr(rightLogo)}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="backLogo">Back Logo</Label>
                    <Input
                      id="backLogo"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setBackLogo(e.target.files?.[0] || null)}
                    />
                    {backLogo && fileErr(backLogo) && (
                      <p className="text-xs text-red-600">
                        {fileErr(backLogo)}
                      </p>
                    )}
                  </div>
                </div>
              </fieldset>

              {/* Other Instructions */}
              <div className="space-y-2">
                <Label htmlFor="otherInstructions">Other Instructions</Label>
                <Textarea
                  id="otherInstructions"
                  placeholder="Colors, special notes, etc."
                  value={form.otherInstructions}
                  onChange={(e) =>
                    updateField("otherInstructions", e.target.value)
                  }
                />
              </div>

              {/* Deadline */}
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="deadlineDate">Deadline Date *</Label>
                  <Input
                    id="deadlineDate"
                    type="date"
                    min={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
                    value={form.deadlineDate}
                    onChange={(e) =>
                      updateField("deadlineDate", e.target.value)
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deadlineTime">Deadline Time *</Label>
                  <Input
                    id="deadlineTime"
                    type="time"
                    min="08:00"
                    max="17:00"
                    value={form.deadlineTime}
                    onChange={(e) =>
                      updateField("deadlineTime", e.target.value)
                    }
                    required
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method *</Label>
                <select
                  id="paymentMethod"
                  className="flex h-10 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm"
                  value={form.paymentMethod}
                  onChange={(e) =>
                    updateField("paymentMethod", e.target.value)
                  }
                >
                  {(paymentMethods || []).map((pm) => (
                    <option key={pm.id} value={pm.name} disabled={pm.is_available !== 1}>
                      {pm.name}{pm.is_available !== 1 ? " (Unavailable)" : ""}
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
              {form.productType && (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-neutral-700">Order Pricing</h3>
                  <div className="flex justify-between text-sm text-neutral-600">
                    <span>Product Type</span>
                    <span>{form.productType}</span>
                  </div>
                  <div className="flex justify-between text-sm text-neutral-600">
                    <span>Price per unit</span>
                    <span>{formatCurrency(unitPriceCents)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-neutral-600">
                    <span>Total players (quantity)</span>
                    <span>{totalPlayers}</span>
                  </div>
                  <div className="flex justify-between border-t border-neutral-300 pt-2 text-base font-bold text-neutral-900">
                    <span>Total Payable</span>
                    <span>{formatCurrency(totalCents)}</span>
                  </div>
                </div>
              )}

              {/* Map Pin Location */}
              <fieldset className="space-y-4 rounded-xl border border-neutral-200 p-4">
                <legend className="px-2 text-sm font-semibold text-neutral-700">
                  Map Pin Location *
                </legend>
                <p className="text-xs text-neutral-500">
                  Click the map to set your delivery pin, or enter coordinates
                  manually. This is required.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Latitude</Label>
                    <Input
                      value={form.mapLat}
                      onChange={(e) =>
                        updateField("mapLat", e.target.value)
                      }
                      placeholder="e.g. 9.3068"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Longitude</Label>
                    <Input
                      value={form.mapLng}
                      onChange={(e) =>
                        updateField("mapLng", e.target.value)
                      }
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
                  {submitting ? "Submitting..." : "Submit Custom Order"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>}
      </section>
    </AnimatedPage>
  );
}

/**
 * Leaflet map loader — loads the library dynamically so no npm dependency is
 * required ('use client' environment, loaded on demand).
 */
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

    // Only initialize map once
    if (mapRef.current) return;

    const defaultLat = lat ? Number(lat) : 9.3068;
    const defaultLng = lng ? Number(lng) : 123.8854;

    // Load Leaflet CSS
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Load Leaflet JS
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
          placeMarker({ lat: Number(lat), lng: Number(lng) });
        }
      } catch (error) {
        console.error("Map initialization error:", error);
      }
    };
    script.onerror = () => console.error("Failed to load Leaflet library");
    document.body.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker when coordinates change externally
  useEffect(() => {
    if (mapRef.current && lat && lng) {
      const newLat = Number(lat);
      const newLng = Number(lng);
      if (markerRef.current) {
        markerRef.current.setLatLng([newLat, newLng]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  return <div ref={containerRef} id="map-container" className="h-64 w-full rounded-lg border border-neutral-300" />
}
