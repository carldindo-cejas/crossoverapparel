import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { requireAuth } from "@/lib/auth/guard";
import { listOrders } from "@/services/order.service";

export async function GET(request: NextRequest) {
  try {
    const env = getWorkerEnv();
    await requireAuth(request, env.AUTH_SECRET, ["owner"]);

    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "50");
    const offset = Number(request.nextUrl.searchParams.get("offset") ?? "0");

    const orders = await listOrders(env, Number.isFinite(limit) ? limit : 50, Number.isFinite(offset) ? offset : 0);
    return ok(orders);
  } catch (error) {
    return fail(error);
  }
}
