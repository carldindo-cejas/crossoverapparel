"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { type ApiEnvelope } from "@/lib/types";

type LightningInvoice = {
  invoice: string;
  amountSats: number;
  amountBtc: string;
  amountPhp: number;
  btcPhpRate: number;
  lightningAddress: string;
  orderNumber: string;
  totalCents: number;
};

/*  Manual QR Payment Modal  */
function ManualPaymentModal({
  orderNumber,
  totalCents,
  onClose,
  onPaymentCompleted,
}: {
  orderNumber: string;
  totalCents: number;
  onClose: () => void;
  onPaymentCompleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

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
      const payload = await res.json() as { success: boolean; error?: { message?: string } };
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
      const payload = await res.json() as { success: boolean; error?: { message?: string } };
      if (!res.ok || !payload.success) {
        throw new Error(payload.error?.message || "Failed to confirm payment");
      }
      setConfirmed(true);
      onPaymentCompleted();
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-sm rounded-3xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200 transition-colors"
          aria-label="Close"
        >
          
        </button>

        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Manual Payment</p>
            <h2 className="mt-1 text-xl font-bold text-neutral-900">Scan QR to Pay</h2>
            <p className="mt-1 text-sm text-neutral-500 font-mono">{orderNumber}</p>
          </div>

          {/* Amount */}
          <div className="rounded-2xl bg-amber-50 border border-amber-200 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Amount to Transfer</p>
            <p className="mt-1 text-4xl font-extrabold text-amber-700">{formatCurrency(totalCents)}</p>
            <p className="mt-1 text-sm text-amber-600">Please send exactly this amount</p>
          </div>

          {/* QR Code */}
          <div className="flex justify-center">
            <div className="rounded-2xl border-2 border-neutral-100 bg-white p-3 shadow-inner">
              <Image
                src="/images/isle_qr.jpg"
                alt="Payment QR Code"
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
              <li>Open Wallet that supports Lightning Payment</li>
              <li>Tap <strong>Scan QR</strong> and scan the code above</li>
              <li>Enter exactly <strong>{formatCurrency(totalCents)}</strong></li>
              <li>Add order number <strong className="font-mono">{orderNumber}</strong> in the notes (optional)</li>
              <li>Upload the receipt below</li>
              <li>Tap <strong>Complete Payment</strong></li>
            </ol>
          </div>

          <p className="text-center text-xs text-neutral-400">
            Your order will be confirmed once payment is verified.
          </p>

          {/* Receipt Upload */}
          {!confirmed && (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-3">
              <p className="text-sm font-semibold text-neutral-800"> Attach Payment Receipt</p>
              <p className="text-xs text-neutral-500">Upload a screenshot or photo of your payment confirmation.</p>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-300 bg-white p-4 transition hover:border-amber-400 hover:bg-amber-50">
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
              {uploading && <p className="text-xs text-amber-600 text-center">Uploading receipt...</p>}
              {uploadSuccess && <p className="text-xs text-green-600 text-center"> Receipt uploaded successfully</p>}
            </div>
          )}

          {confirmed ? (
            <div className="rounded-2xl bg-green-50 border border-green-200 p-4 text-center space-y-2">
              <p className="text-2xl"></p>
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
                disabled={confirming || !uploadSuccess}
                className="w-full bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
              >
                {confirming ? "Confirming..." : " I've Completed Payment"}
              </Button>
              {!uploadSuccess && (
                <p className="text-xs text-amber-600 text-center"> Upload a payment receipt to enable this button</p>
              )}
              <Button onClick={onClose} className="w-full" variant="outline">
                Cancel
              </Button>
            </div>
          )}

          {confirmed && (
            <Button onClick={onClose} className="w-full" variant="outline">
              Close
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/*  Lightning Payment  */
export function LightningPayment({
  orderNumber,
  totalCents,
  phone,
}: {
  orderNumber: string;
  totalCents: number;
  phone?: string;
}) {
  const [invoice, setInvoice] = useState<LightningInvoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);

  const generateInvoice = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderNumber)}/lightning-invoice`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(phone ? { "x-customer-phone": phone } : {}),
          },
        }
      );
      let payload: ApiEnvelope<LightningInvoice>;
      try {
        payload = (await res.json()) as ApiEnvelope<LightningInvoice>;
      } catch {
        throw new Error(`Server error (${res.status}). Please try again.`);
      }
      if (!res.ok || !payload.success) {
        const msg =
          !payload.success
            ? payload.error?.message || `Request failed (${res.status})`
            : `Request failed (${res.status})`;
        throw new Error(msg);
      }
      setInvoice(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [orderNumber, phone]);

  async function copyInvoice() {
    if (!invoice) return;
    try {
      await navigator.clipboard.writeText(invoice.invoice);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement("textarea");
      el.value = invoice.invoice;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <>
      {showManual && (
        <ManualPaymentModal
          orderNumber={orderNumber}
          totalCents={totalCents}
          onClose={() => setShowManual(false)}
          onPaymentCompleted={() => {
            setPaymentCompleted(true);
            setShowManual(false);
          }}
        />
      )}

      <Card className="border-amber-200 bg-amber-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-900">
            <span className="text-xl"></span> Pay with Bitcoin Lightning
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-neutral-700">
            Pay <span className="font-semibold">{formatCurrency(totalCents)}</span> for
            order <span className="font-mono font-semibold">{orderNumber}</span> using
            Bitcoin Lightning Network.
          </p>

          {paymentCompleted ? (
            <div className="rounded-2xl bg-green-50 border border-green-200 p-4 text-center space-y-2">
              <p className="text-2xl"></p>
              <p className="text-lg font-bold text-green-800">Payment is pending confirmation!</p>
              <p className="text-sm text-green-600">
                Thank you! Your order <strong className="font-mono">{orderNumber}</strong> is waiting to be confirmed.
              </p>
            </div>
          ) : (
            <>
              {!invoice && (
                <div className="flex flex-wrap gap-3">
                  <Button onClick={generateInvoice} disabled={loading} className="bg-amber-600 hover:bg-amber-700">
                    {loading ? "Generating Invoice..." : "Generate Lightning Invoice"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowManual(true)}
                    className="border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                  >
                     Pay Manually (Scan QR)
                  </Button>
                </div>
              )}

              {error && (
                <div className="space-y-3">
                  <p className="text-sm text-red-600">{error}</p>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setError(null); generateInvoice(); }}
                    >
                      Try Again
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setShowManual(true)}
                      className="bg-neutral-900 text-white hover:bg-neutral-700"
                    >
                       Pay Manually Instead
                    </Button>
                  </div>
                </div>
              )}

              {invoice && (
                <div className="space-y-4">
                  {/* QR Code */}
                  <div className="flex justify-center">
                    <div className="rounded-2xl border-2 border-amber-200 bg-white p-4">
                      <QRCodeSVG
                        value={invoice.invoice.toUpperCase()}
                        size={240}
                        level="M"
                        marginSize={2}
                      />
                    </div>
                  </div>

                  {/* Amount Info */}
                  <div className="rounded-xl bg-white p-4 text-center space-y-1">
                    <p className="text-2xl font-bold text-neutral-900">
                      {invoice.amountSats.toLocaleString()} sats
                    </p>
                    <p className="text-sm text-neutral-500">
                       {invoice.amountBtc} BTC
                    </p>
                    <p className="text-sm text-neutral-500">
                      = {formatCurrency(invoice.totalCents)} PHP
                    </p>
                    <p className="text-xs text-neutral-400 mt-1">
                      Rate: 1 BTC = {invoice.btcPhpRate.toLocaleString()}
                    </p>
                  </div>

                  {/* Invoice string */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-neutral-500">Lightning Invoice</p>
                    <div className="relative rounded-lg border border-neutral-200 bg-white p-3">
                      <p className="break-all font-mono text-xs text-neutral-600 pr-16">
                        {invoice.invoice}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute right-2 top-2"
                        onClick={copyInvoice}
                      >
                        {copied ? "Copied!" : "Copy"}
                      </Button>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="rounded-xl bg-white p-4 space-y-2">
                    <p className="text-sm font-semibold text-neutral-800">How to pay:</p>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-neutral-600">
                      <li>Open your Lightning wallet app</li>
                      <li>Scan the QR code or paste the invoice</li>
                      <li>Confirm the payment in your wallet</li>
                      <li>Payment is received instantly</li>
                    </ol>
                    <p className="text-xs text-neutral-400 mt-2">
                      Sending to: {invoice.lightningAddress}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setInvoice(null);
                        setError(null);
                        generateInvoice();
                      }}
                    >
                      Refresh Invoice
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowManual(true)}
                    >
                       Pay Manually Instead
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
