import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "ROUTE_DEPRECATED",
        message: "Deprecated route. Use /api/auth/owner/login instead."
      }
    },
    { status: 410 }
  );
}
