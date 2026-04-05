import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { getWorkerEnv } from "@/lib/env";
import { getOrderByNumber } from "@/services/order.service";
import { verifySessionToken } from "@/lib/auth/token";

const LIGHTNING_ADDRESS = "projectkaru@isle.ph";
const FETCH_TIMEOUT_MS = 10_000;

function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

async function getLnurlPayEndpoint(): Promise<{
  callback: string;
  minSendable: number;
  maxSendable: number;
}> {
  const [user, domain] = LIGHTNING_ADDRESS.split("@");
  const url = `https://${domain}/.well-known/lnurlp/${user}`;

  let res: Response;
  try {
    res = await fetchWithTimeout(url, { headers: { Accept: "application/json", "User-Agent": "CrossoverApparel/1.0" } });
  } catch {
    throw new AppError("Could not reach Lightning service. Please try again.", 503, "LIGHTNING_UNREACHABLE");
  }

  if (!res.ok) {
    throw new AppError(`Lightning service returned ${res.status}. Please try again.`, 503, "LIGHTNING_UNAVAILABLE");
  }

  let data: { callback: string; minSendable: number; maxSendable: number; status?: string; reason?: string };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    throw new AppError("Invalid response from Lightning service.", 503, "LIGHTNING_INVALID_RESPONSE");
  }

  if (data.status === "ERROR") {
    throw new AppError(data.reason || "Lightning service error", 503, "LIGHTNING_ERROR");
  }
  if (!data.callback || !data.minSendable || !data.maxSendable) {
    throw new AppError("Lightning service returned incomplete data.", 503, "LIGHTNING_INVALID_RESPONSE");
  }

  return { callback: data.callback, minSendable: data.minSendable, maxSendable: data.maxSendable };
}

async function getBtcPhpRate(): Promise<number> {
  // Try CryptoCompare first (more reliable free tier), fall back to CoinGecko
  const sources: Array<() => Promise<number>> = [
    async () => {
      const res = await fetchWithTimeout(
        "https://min-api.cryptocompare.com/data/price?fsym=BTC&tsyms=PHP",
        { headers: { Accept: "application/json", "User-Agent": "CrossoverApparel/1.0" } }
      );
      if (!res.ok) throw new Error(`CryptoCompare: ${res.status}`);
      const data = (await res.json()) as { PHP?: number; Response?: string; Message?: string };
      if (data.Response === "Error") throw new Error(data.Message ?? "CryptoCompare error");
      if (!data.PHP || data.PHP <= 0) throw new Error("CryptoCompare: no PHP rate");
      return data.PHP;
    },
    async () => {
      const res = await fetchWithTimeout(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=php",
        { headers: { Accept: "application/json", "User-Agent": "CrossoverApparel/1.0" } }
      );
      if (!res.ok) throw new Error(`CoinGecko: ${res.status}`);
      const data = (await res.json()) as { bitcoin?: { php?: number } };
      const rate = data.bitcoin?.php;
      if (!rate || rate <= 0) throw new Error("CoinGecko: no PHP rate");
      return rate;
    },
  ];

  const errors: string[] = [];
  for (const source of sources) {
    try {
      return await source();
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  throw new AppError(
    `Unable to fetch BTC/PHP exchange rate. Please try again in a moment. (${errors.join("; ")})`,
    503,
    "RATE_UNAVAILABLE"
  );
}

function phpCentsToMillisats(phpCents: number, btcPhpRate: number): number {
  const phpAmount = phpCents / 100;
  const btcAmount = phpAmount / btcPhpRate;
  const sats = btcAmount * 1e8;
  return Math.round(sats * 1000);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;
    const env = getWorkerEnv();

    // Authenticate: staff token OR customer phone header
    const token =
      request.cookies.get("ca_token")?.value ??
      (request.headers.get("authorization")?.startsWith("Bearer ")
        ? request.headers.get("authorization")!.slice(7)
        : null);
    const customerPhone = request.headers.get("x-customer-phone")?.trim() || null;

    let staffAuthed = false;
    if (token) {
      try {
        const payload = await verifySessionToken(token, env.AUTH_SECRET);
        staffAuthed = !!payload.role;
      } catch {
        // not staff — fall through to customer phone check
      }
    }

    // Fetch order; if no staff auth, phone is verified inside getOrderByNumber
    const order = await getOrderByNumber(
      env,
      orderNumber,
      staffAuthed ? null : customerPhone
    );

    if (order.total_cents <= 0) {
      throw new AppError("Order total must be greater than zero", 422, "INVALID_AMOUNT");
    }

    // Fetch BTC/PHP rate and LNURL endpoint in parallel
    const [btcPhpRate, lnurl] = await Promise.all([
      getBtcPhpRate(),
      getLnurlPayEndpoint(),
    ]);

    const millisats = phpCentsToMillisats(order.total_cents, btcPhpRate);

    // LNURL-pay amount range check
    if (millisats < lnurl.minSendable || millisats > lnurl.maxSendable) {
      const satsDisplay = Math.round(millisats / 1000).toLocaleString();
      const minDisplay = Math.round(lnurl.minSendable / 1000).toLocaleString();
      const maxDisplay = Math.round(lnurl.maxSendable / 1000).toLocaleString();
      throw new AppError(
        `Amount (${satsDisplay} sats) is outside Lightning limits. Min: ${minDisplay} sats, Max: ${maxDisplay} sats.`,
        422,
        "AMOUNT_OUT_OF_RANGE"
      );
    }

    // Request BOLT11 invoice from LNURL callback
    const sep = lnurl.callback.includes("?") ? "&" : "?";
    const callbackUrl = `${lnurl.callback}${sep}amount=${millisats}`;

    let invoiceRes: Response;
    try {
      invoiceRes = await fetchWithTimeout(callbackUrl, {
        headers: { Accept: "application/json", "User-Agent": "CrossoverApparel/1.0" },
      });
    } catch {
      throw new AppError("Could not reach Lightning service to generate invoice. Please try again.", 503, "INVOICE_UNREACHABLE");
    }

    if (!invoiceRes.ok) {
      throw new AppError(`Lightning invoice request failed (${invoiceRes.status}). Please try again.`, 503, "INVOICE_FAILED");
    }

    let invoiceData: { pr?: string; status?: string; reason?: string };
    try {
      invoiceData = (await invoiceRes.json()) as typeof invoiceData;
    } catch {
      throw new AppError("Invalid invoice response from Lightning service.", 503, "INVOICE_INVALID");
    }

    if (invoiceData.status === "ERROR" || !invoiceData.pr) {
      throw new AppError(invoiceData.reason || "Lightning invoice generation failed. Please try again.", 503, "INVOICE_FAILED");
    }

    const phpAmount = order.total_cents / 100;
    const sats = Math.round(millisats / 1000);
    const btcAmount = sats / 1e8;

    return ok({
      invoice: invoiceData.pr,
      amountSats: sats,
      amountBtc: btcAmount.toFixed(8),
      amountPhp: phpAmount,
      btcPhpRate,
      lightningAddress: LIGHTNING_ADDRESS,
      orderNumber: order.order_number,
      totalCents: order.total_cents,
    });
  } catch (error) {
    return fail(error);
  }
}
