import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { requireAuth } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import { deleteProduct, updateProduct } from "@/services/product.service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const env = getWorkerEnv();
    await requireAuth(request, env.AUTH_SECRET, ["owner"]);
    const { id } = await params;
    const productId = Number(id);

    if (!Number.isInteger(productId) || productId <= 0) {
      throw new AppError("Invalid product id", 422, "INVALID_PRODUCT_ID");
    }

    const body = await request.json();
    const result = await updateProduct(env, productId, body);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const env = getWorkerEnv();
    await requireAuth(request, env.AUTH_SECRET, ["owner"]);
    const { id } = await params;
    const productId = Number(id);

    if (!Number.isInteger(productId) || productId <= 0) {
      throw new AppError("Invalid product id", 422, "INVALID_PRODUCT_ID");
    }

    const result = await deleteProduct(env, productId);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
