import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { requireAuth } from "@/lib/auth/guard";

export async function GET(request: NextRequest) {
  try {
    const env = getWorkerEnv();
    const session = await requireAuth(request, env.AUTH_SECRET, ["owner", "designer", "customer"]);
    return ok(session);
  } catch (error) {
    return fail(error);
  }
}
