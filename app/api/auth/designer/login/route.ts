import { NextRequest, NextResponse } from "next/server";
import { ok, fail, parseJson } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { loginByRole } from "@/services/auth.service";

export async function POST(request: NextRequest) {
  try {
    const env = getWorkerEnv();
    const body = await parseJson(request, (v) => v);
    const result = await loginByRole(env, "designer", body);

    const response = NextResponse.json({ success: true, data: { user: result.user } });
    response.cookies.set("ca_token", result.token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8
    });
    return response;
  } catch (error) {
    return fail(error);
  }
}
