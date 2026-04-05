import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { uploadPaymentReceipt } from "@/services/order.service";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const env = getWorkerEnv();
    const { orderNumber } = await params;

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new AppError("file is required", 400, "FILE_REQUIRED");
    }

    if (file.size <= 0) {
      throw new AppError("Uploaded file is empty", 400, "EMPTY_FILE");
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new AppError("File exceeds maximum size of 10 MB", 413, "FILE_TOO_LARGE");
    }

    const mimeType = file.type || "application/octet-stream";
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new AppError(
        `File type '${mimeType}' is not allowed. Accepted: images, PDF.`,
        415,
        "UNSUPPORTED_MEDIA_TYPE"
      );
    }

    const result = await uploadPaymentReceipt(env, orderNumber, file);
    return ok(result, 201);
  } catch (error) {
    return fail(error);
  }
}
