import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { getProducts } from "@/services/product.service";

export async function GET(_request: NextRequest) {
  try {
    const env = getWorkerEnv();
    const products = await getProducts(env);
    return ok(products);
  } catch (error) {
    console.error("GET /api/products failed", error);
    return fail(error);
  }
}
