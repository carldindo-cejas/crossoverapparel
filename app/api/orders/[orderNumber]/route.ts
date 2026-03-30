import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { getOrderByNumber } from "@/services/order.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;
    const env = getWorkerEnv();
    const order = await getOrderByNumber(env, orderNumber);
    return ok(order);
  } catch (error) {
    return fail(error);
  }
}
