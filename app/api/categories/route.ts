import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { getCategories } from "@/services/product.service";

export async function GET(_request: NextRequest) {
  try {
    const env = getWorkerEnv();
    const categories = await getCategories(env);
    return ok(categories);
  } catch (error) {
    console.error("GET /api/categories failed", error);
    return fail(error);
  }
}
