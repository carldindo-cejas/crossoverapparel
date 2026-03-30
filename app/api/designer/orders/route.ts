import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { requireAuth } from "@/lib/auth/guard";
import { listActiveOrders } from "@/services/designer.service";

export async function GET(request: NextRequest) {
  try {
    const env = getWorkerEnv();
    await requireAuth(request, env.AUTH_SECRET, ["designer"]);
    const orders = await listActiveOrders(env);
    return ok(orders);
  } catch (error) {
    return fail(error);
  }
}
