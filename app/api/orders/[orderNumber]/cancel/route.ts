import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { getWorkerEnv } from "@/lib/env";
import { cancelOrderByCustomer } from "@/services/order.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;
    const env = getWorkerEnv();

    const customerPhone = request.headers.get("x-customer-phone")?.trim() ?? null;

    if (!customerPhone) {
      throw new AppError("Phone verification required to cancel this order", 401, "VERIFICATION_REQUIRED");
    }

    const result = await cancelOrderByCustomer(env, orderNumber, customerPhone);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
