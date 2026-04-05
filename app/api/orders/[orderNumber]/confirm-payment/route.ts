import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { confirmPaymentByCustomer } from "@/services/order.service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const env = getWorkerEnv();
    const { orderNumber } = await params;
    const result = await confirmPaymentByCustomer(env, orderNumber);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
