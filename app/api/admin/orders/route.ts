import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { requireAuth } from "@/lib/auth/guard";
import { listOrders } from "@/services/order.service";

export async function GET(request: NextRequest) {
  try {
    const env = getWorkerEnv();
    await requireAuth(request, env.AUTH_SECRET, ["owner"]);

    const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? "50");
    const rawOffset = Number(request.nextUrl.searchParams.get("offset") ?? "0");
    const limit = Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 50, 100);
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

    const orders = await listOrders(env, limit, offset);
    return ok(orders);
  } catch (error) {
    return fail(error);
  }
}
