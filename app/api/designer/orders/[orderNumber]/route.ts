import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { requireAuth } from "@/lib/auth/guard";
import { getAssignedOrderDetails } from "@/services/designer.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const env = getWorkerEnv();
    const session = await requireAuth(request, env.AUTH_SECRET, ["designer"]);
    const { orderNumber } = await params;
    const order = await getAssignedOrderDetails(env, session.sub, orderNumber);
    return ok(order);
  } catch (error) {
    return fail(error);
  }
}
