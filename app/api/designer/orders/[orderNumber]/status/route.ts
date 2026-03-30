import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { getWorkerEnv } from "@/lib/env";
import { requireAuth } from "@/lib/auth/guard";
import { getOrderIdByNumber } from "@/services/designer.service";
import { updateOrderStatus } from "@/services/order.service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const env = getWorkerEnv();
    const session = await requireAuth(request, env.AUTH_SECRET, ["designer"]);
    const { orderNumber } = await params;

    if (!orderNumber || orderNumber.trim() === "") {
      throw new AppError("Invalid order number", 422, "INVALID_ORDER_NUMBER");
    }

    const orderId = await getOrderIdByNumber(env, orderNumber);
    const body = await request.json();
    const result = await updateOrderStatus(env, orderId, session.sub, body);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
