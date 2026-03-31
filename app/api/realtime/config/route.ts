import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const host = request.headers.get("host") || "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const wsProto = proto === "https" ? "wss" : "ws";

  return NextResponse.json({
    success: true,
    data: {
      wsUrl: `${wsProto}://${host}/api/presence`
    }
  });
}
