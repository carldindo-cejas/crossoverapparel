import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { requireAuth } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import { uploadProductImage } from "@/services/product.service";

export async function POST(
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

    const formData = await request.formData();
    const file = formData.get("file") ?? formData.get("image");

    if (!(file instanceof File)) {
      throw new AppError("image file is required", 400, "FILE_REQUIRED");
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new AppError("Image must be under 5MB", 400, "FILE_TOO_LARGE");
    }

    const result = await uploadProductImage(env, productId, file);
    return ok(result, 201);
  } catch (error) {
    return fail(error);
  }
}
