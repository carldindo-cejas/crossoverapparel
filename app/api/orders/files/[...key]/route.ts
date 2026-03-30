import { NextRequest, NextResponse } from "next/server";
import { getWorkerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { fail } from "@/lib/api";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  try {
    const { key } = await params;
    const objectKey = key.join("/");

    if (!objectKey) {
      throw new AppError("File key is required", 400, "MISSING_KEY");
    }

    const env = getWorkerEnv();
    const bucket = env.ORDER_FILES;

    if (!bucket) {
      throw new AppError("ORDER_FILES R2 bucket not configured", 500, "R2_NOT_CONFIGURED");
    }

    const object = await bucket.get(objectKey);

    if (!object) {
      throw new AppError("File not found", 404, "FILE_NOT_FOUND");
    }

    const headers = new Headers();
    headers.set("Content-Type", object.httpMetadata?.contentType || "application/octet-stream");
    headers.set("Cache-Control", "public, max-age=86400");

    // Extract filename from key
    const fileName = objectKey.split("/").pop() || "download";
    headers.set("Content-Disposition", `inline; filename="${fileName}"`);

    return new NextResponse(object.body, { status: 200, headers });
  } catch (error) {
    return fail(error);
  }
}
