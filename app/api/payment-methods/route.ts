import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { listPaymentMethods } from "@/services/payment-method.service";

export async function GET(_request: NextRequest) {
  try {
    const env = getWorkerEnv();
    const methods = await listPaymentMethods(env);
    return ok(methods);
  } catch (error) {
    return fail(error);
  }
}
