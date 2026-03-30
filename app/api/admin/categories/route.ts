import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { requireAuth } from "@/lib/auth/guard";
import { createCategory } from "@/services/category.service";
import { getCategories } from "@/services/product.service";

export async function GET(request: NextRequest) {
  try {
    const env = getWorkerEnv();
    await requireAuth(request, env.AUTH_SECRET, ["owner"]);
    const categories = await getCategories(env);
    return ok(categories);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const env = getWorkerEnv();
    await requireAuth(request, env.AUTH_SECRET, ["owner"]);
    const body = await request.json();
    const result = await createCategory(env, body);
    return ok(result, 201);
  } catch (error) {
    return fail(error);
  }
}
