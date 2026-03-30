import { NextRequest, NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { loginOwner } from "@/services/auth.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const env = getWorkerEnv();
    const result = await loginOwner(env, body);

    const response = NextResponse.json({ success: true, data: { user: result.user } });
    response.cookies.set("ca_token", result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 8
    });

    return response;
  } catch (error) {
    return fail(error);
  }
}
