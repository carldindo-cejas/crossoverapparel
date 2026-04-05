import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { getWorkerEnv } from "@/lib/env";
import { requireAuth } from "@/lib/auth/guard";
import { updateDesignerStatus } from "@/services/designer.service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const env = getWorkerEnv();
    const session = await requireAuth(request, env.AUTH_SECRET, ["designer"]);
    const { orderNumber } = await params;

    if (!orderNumber || orderNumber.trim() === "") {
      throw new AppError("Invalid order number", 422, "INVALID_ORDER_NUMBER");
    }

    const body = (await request.json()) as { status?: string };
    const designerStatus = body.status;

    if (!designerStatus || !["received", "working", "done"].includes(designerStatus)) {
      throw new AppError("Status must be received, working, or done", 422, "INVALID_STATUS");
    }

    const result = await updateDesignerStatus(env, session.sub, orderNumber, designerStatus);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
