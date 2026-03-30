import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { requireAuth } from "@/lib/auth/guard";
import { createProduct } from "@/services/product.service";

export async function POST(request: NextRequest) {
  try {
    const env = getWorkerEnv();
    const session = await requireAuth(request, env.AUTH_SECRET, ["owner"]);
    const body = await request.json();
    const result = await createProduct(env, session.sub, body);
    return ok(result, 201);
  } catch (error) {
    return fail(error);
  }
}
