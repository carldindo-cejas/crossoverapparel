import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { requireAuth } from "@/lib/auth/guard";
import { updateOrderStatus } from "@/services/order.service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const env = getWorkerEnv();
    const session = await requireAuth(request, env.AUTH_SECRET, ["owner"]);
    const { orderId } = await params;
    const body = await request.json();
    const result = await updateOrderStatus(env, orderId, session.sub, body);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
