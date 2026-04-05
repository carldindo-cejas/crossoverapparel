import { z } from "zod";
import { getDb, type WorkerEnv } from "@/db/client";
import { sqlRun } from "@/db/raw";
import { AppError } from "@/lib/errors";

const metadataSchema = z.object({
  orderId: z.string().uuid().optional(),
  orderItemId: z.number().int().positive().optional()
});

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  // SVG intentionally excluded — SVG files can contain embedded scripts (stored XSS)
  "application/pdf",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
]);

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export async function uploadFileToR2(
  env: WorkerEnv,
  file: File,
  rawMetadata: unknown,
  uploadedBy?: string
) {
  const bucket = env.ORDER_FILES ?? env.ASSETS;
  if (!bucket) {
    throw new AppError("R2 bucket binding ORDER_FILES is not configured", 500, "R2_NOT_CONFIGURED");
  }

  const metadata = metadataSchema.parse(rawMetadata);
  if (file.size <= 0) {
    throw new AppError("Uploaded file is empty", 400, "EMPTY_FILE");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new AppError("File exceeds maximum size of 25 MB", 413, "FILE_TOO_LARGE");
  }

  const mimeType = file.type || "application/octet-stream";
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new AppError(
      `File type '${mimeType}' is not allowed. Accepted: images, PDF, ZIP, XLSX, CSV.`,
      415,
      "UNSUPPORTED_MEDIA_TYPE"
    );
  }

  const sanitizedBase = file.name.replace(/[^a-zA-Z0-9._\-\[\] ]/g, "_");
  const keyPrefix = metadata.orderId ? `orders/${metadata.orderId}` : "uploads";
  const key = `${keyPrefix}/${crypto.randomUUID()}-${sanitizedBase}`;
  const bytes = await file.arrayBuffer();

  await bucket.put(key, bytes, {
    httpMetadata: {
      contentType: file.type || "application/octet-stream"
    }
  });

  if (metadata.orderId) {
    const db = getDb(env);
    await sqlRun(
      db,
      `INSERT INTO order_files (order_id, order_item_id, r2_key, file_name, mime_type, size_bytes, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)` ,
      [
        metadata.orderId,
        metadata.orderItemId ?? null,
        key,
        file.name,
        file.type || "application/octet-stream",
        file.size,
        uploadedBy ?? null
      ]
    );
  }

  const fileUrl = env.R2_PUBLIC_BASE_URL
    ? `${env.R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`
    : key;

  return {
    key,
    fileUrl,
    size: file.size,
    mimeType: file.type || "application/octet-stream"
  };
}
