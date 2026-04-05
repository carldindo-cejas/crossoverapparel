import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { getWorkerEnv } from "@/lib/env";
import { verifySessionToken } from "@/lib/auth/token";
import { getOrderByNumber } from "@/services/order.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;
    const env = getWorkerEnv();

    // Allow authenticated staff (owner / designer) to skip phone verification
    const token =
      request.cookies.get("ca_token")?.value ??
      (request.headers.get("authorization")?.startsWith("Bearer ")
        ? request.headers.get("authorization")!.slice(7)
        : null);

    let staffAuthed = false;
    if (token) {
      try {
        const payload = await verifySessionToken(token, env.AUTH_SECRET);
        staffAuthed = payload.role === "owner" || payload.role === "designer";
      } catch {
        // Invalid token — fall through to phone check
      }
    }

    const customerPhone = request.headers.get("x-customer-phone")?.trim() ?? null;

    if (!staffAuthed && !customerPhone) {
      throw new AppError(
        "Phone verification required to view this order.",
        401,
        "VERIFICATION_REQUIRED"
      );
    }

    const order = await getOrderByNumber(
      env,
      orderNumber,
      staffAuthed ? null : customerPhone
    );
    return ok(order);
  } catch (error) {
    return fail(error);
  }
}
