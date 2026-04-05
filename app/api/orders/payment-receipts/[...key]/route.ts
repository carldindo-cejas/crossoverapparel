import { NextRequest, NextResponse } from "next/server";
import { getWorkerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { fail } from "@/lib/api";
import { requireAuth } from "@/lib/auth/guard";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  try {
    const { key } = await params;
    const objectKey = key.join("/");

    if (!objectKey) {
      throw new AppError("File key is required", 400, "MISSING_KEY");
    }

    const env = getWorkerEnv();

    // Only staff (owner/designer) can view payment receipts
    await requireAuth(request, env.AUTH_SECRET, ["owner", "designer"]);

    const bucket = env.PAYMENT_RECEIPTS;

    if (!bucket) {
      throw new AppError("PAYMENT_RECEIPTS R2 bucket not configured", 500, "R2_NOT_CONFIGURED");
    }

    const object = await bucket.get(objectKey);

    if (!object) {
      throw new AppError("File not found", 404, "FILE_NOT_FOUND");
    }

    const headers = new Headers();
    headers.set("Content-Type", object.httpMetadata?.contentType || "application/octet-stream");
    headers.set("Cache-Control", "private, no-store");

    const fileName = objectKey.split("/").pop() || "receipt";
    headers.set("Content-Disposition", `inline; filename="${fileName}"`);

    return new NextResponse(object.body, { status: 200, headers });
  } catch (error) {
    return fail(error);
  }
}
