import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { requireAuth } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import { uploadFileToR2 } from "@/services/upload.service";

export async function POST(request: NextRequest) {
  try {
    const env = getWorkerEnv();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new AppError("file is required", 400, "FILE_REQUIRED");
    }

    const orderId = formData.get("orderId");
    const orderItemId = formData.get("orderItemId");
    const parsedOrderItemId =
      typeof orderItemId === "string" && orderItemId.trim() !== ""
        ? Number(orderItemId)
        : undefined;

    if (typeof parsedOrderItemId === "number" && !Number.isInteger(parsedOrderItemId)) {
      throw new AppError("orderItemId must be an integer", 422, "INVALID_ORDER_ITEM_ID");
    }

    // Allow unauthenticated uploads when an orderId is provided (guest order file uploads)
    let uploadedBy: string | undefined;
    if (typeof orderId === "string" && orderId.trim() !== "") {
      // Guest upload — orderId acts as the authorization scope
      try {
        const session = await requireAuth(request, env.AUTH_SECRET, ["owner", "designer", "customer"]);
        uploadedBy = session.sub;
      } catch {
        // Guest customer — no auth token, upload is scoped to orderId
        uploadedBy = undefined;
      }
    } else {
      // No orderId — require authentication
      const session = await requireAuth(request, env.AUTH_SECRET, ["owner", "designer", "customer"]);
      uploadedBy = session.sub;
    }

    const result = await uploadFileToR2(
      env,
      file,
      {
        orderId: typeof orderId === "string" ? orderId : undefined,
        orderItemId: parsedOrderItemId
      },
      uploadedBy
    );

    return ok(result, 201);
  } catch (error) {
    return fail(error);
  }
}
