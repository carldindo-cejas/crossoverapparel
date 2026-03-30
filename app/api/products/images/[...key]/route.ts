import { NextRequest, NextResponse } from "next/server";
import { getWorkerEnv } from "@/lib/env";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  try {
    const env = getWorkerEnv();
    const bucket = env.PRODUCT_IMAGES;
    if (!bucket) {
      return NextResponse.json({ error: "Not configured" }, { status: 500 });
    }

    const { key } = await params;
    const r2Key = key.join("/");
    const object = await bucket.get(r2Key);

    if (!object) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const headers = new Headers();
    headers.set("Content-Type", object.httpMetadata?.contentType || "image/jpeg");
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    return new NextResponse(object.body as ReadableStream, { headers });
  } catch {
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 500 });
  }
}
