"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";

export function InstaPayPayment({
  orderNumber,
  totalCents,
}: {
  orderNumber: string;
  totalCents: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  async function handleUploadReceipt(file: File) {
    setUploading(true);
    setConfirmError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderNumber)}/payment-receipt`,
        { method: "POST", body: formData }
      );
      const payload = (await res.json()) as { success: boolean; error?: { message?: string } };
      if (!res.ok || !payload.success) {
        throw new Error(payload.error?.message || "Failed to upload receipt");
      }
      setUploadSuccess(true);
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Failed to upload receipt");
      setUploadSuccess(false);
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirmPayment() {
    if (!receiptFile || !uploadSuccess) {
      setConfirmError("Please upload a payment receipt before completing payment.");
      return;
    }
    setConfirming(true);
    setConfirmError(null);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderNumber)}/confirm-payment`,
        { method: "POST" }
      );
      const payload = (await res.json()) as { success: boolean; error?: { message?: string } };
      if (!res.ok || !payload.success) {
        throw new Error(payload.error?.message || "Failed to confirm payment");
      }
      setConfirmed(true);
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <span className="text-xl">💸</span> Pay via InstaPay
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-neutral-700">
          Pay <span className="font-semibold">{formatCurrency(totalCents)}</span> for
          order <span className="font-mono font-semibold">{orderNumber}</span> via InstaPay.
        </p>

        {/* Amount */}
        <div className="rounded-2xl bg-blue-50 border border-blue-200 py-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Amount to Transfer</p>
          <p className="mt-1 text-4xl font-extrabold text-blue-700">{formatCurrency(totalCents)}</p>
          <p className="mt-1 text-sm text-blue-600">Please send exactly this amount</p>
        </div>

        {/* QR Code */}
        <div className="flex justify-center">
          <div className="rounded-2xl border-2 border-neutral-100 bg-white p-3 shadow-inner">
            <Image
              src="/images/instapay_qr.jpg"
              alt="InstaPay QR Code"
              width={240}
              height={240}
              className="rounded-xl"
              priority
            />
          </div>
        </div>

        {/* Instructions */}
        <div className="rounded-xl bg-neutral-50 p-4 space-y-2">
          <p className="text-sm font-semibold text-neutral-800">How to pay:</p>
          <ol className="list-decimal list-inside space-y-1 text-sm text-neutral-600">
            <li>Open your mobile banking or e-wallet app</li>
            <li>Tap <strong>Scan QR</strong> and scan the code above</li>
            <li>Enter exactly <strong>{formatCurrency(totalCents)}</strong></li>
            <li>Add order number <strong className="font-mono">{orderNumber}</strong> in the notes (optional)</li>
            <li>Upload the receipt screenshot below</li>
            <li>Tap <strong>Complete Payment</strong></li>
          </ol>
        </div>

        <p className="text-center text-xs text-neutral-400">
          Your order will be confirmed once payment is verified.
        </p>

        {/* Receipt Upload */}
        {!confirmed && (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-3">
            <p className="text-sm font-semibold text-neutral-800">📎 Attach Payment Receipt</p>
            <p className="text-xs text-neutral-500">Upload a screenshot or photo of your payment confirmation.</p>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-300 bg-white p-4 transition hover:border-blue-400 hover:bg-blue-50">
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setReceiptFile(f);
                  setUploadSuccess(false);
                  if (f) handleUploadReceipt(f);
                }}
              />
              {receiptFile ? (
                <span className="text-sm text-neutral-700 truncate max-w-[200px]">{receiptFile.name}</span>
              ) : (
                <span className="text-sm text-neutral-500">Tap to select file</span>
              )}
            </label>
            {uploading && <p className="text-xs text-blue-600 text-center">Uploading receipt...</p>}
            {uploadSuccess && <p className="text-xs text-green-600 text-center">✅ Receipt uploaded successfully</p>}
          </div>
        )}

        {confirmed ? (
          <div className="rounded-2xl bg-green-50 border border-green-200 p-4 text-center space-y-2">
            <p className="text-2xl">✅</p>
            <p className="text-lg font-bold text-green-800">Payment is pending confirmation!</p>
            <p className="text-sm text-green-600">
              Thank you! Your order <strong className="font-mono">{orderNumber}</strong> is waiting to be confirmed.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {confirmError && (
              <p className="text-sm text-red-600 text-center">{confirmError}</p>
            )}
            <Button
              onClick={handleConfirmPayment}
              disabled={confirming || uploading || !uploadSuccess}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            >
              {confirming ? "Confirming..." : "✓ I've Completed Payment"}
            </Button>
            {!uploadSuccess && (
              <p className="text-xs text-blue-600 text-center">⚠ Upload a payment receipt to enable this button</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
