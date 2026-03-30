import { NextRequest } from "next/server";
import { ok, fail, parseJson } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { createOrder } from "@/services/order.service";

export async function POST(request: NextRequest) {
  try {
    const payload = await parseJson(request, (v) => v);
    const env = getWorkerEnv();
    const order = await createOrder(env, payload);
    return ok(order, 201);
  } catch (error) {
    return fail(error);
  }
}
