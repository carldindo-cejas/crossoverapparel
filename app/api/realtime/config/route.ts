import { NextResponse } from "next/server";

export async function GET() {
  const fallbackProtocol = process.env.NODE_ENV === "development" ? "ws" : "wss";
  const fallbackHost = process.env.NEXT_PUBLIC_APP_HOST || "localhost:3000";

  return NextResponse.json({
    success: true,
    data: {
      wsUrl: process.env.NEXT_PUBLIC_REALTIME_WS_URL || `${fallbackProtocol}://${fallbackHost}/api/presence`
    }
  });
}
