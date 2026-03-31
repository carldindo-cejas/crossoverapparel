import { NextRequest } from "next/server";
import { ok, fail, parseJson } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { requireAuth } from "@/lib/auth/guard";
import { listPaymentMethods, updatePaymentMethodStatus } from "@/services/payment-method.service";

export async function GET(request: NextRequest) {
  try {
    const env = getWorkerEnv();
    await requireAuth(request, env.AUTH_SECRET, ["owner"]);
    const methods = await listPaymentMethods(env);
    return ok(methods);
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const env = getWorkerEnv();
    await requireAuth(request, env.AUTH_SECRET, ["owner"]);
    const body = await parseJson(request, (v) => v as { id: number; isAvailable: boolean });
    const result = await updatePaymentMethodStatus(env, body.id, body.isAvailable);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
