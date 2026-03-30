import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { requireAuth } from "@/lib/auth/guard";
import { getSalesAnalytics } from "@/services/sales.service";

export async function GET(request: NextRequest) {
  try {
    const env = getWorkerEnv();
    await requireAuth(request, env.AUTH_SECRET, ["owner"]);

    const from = request.nextUrl.searchParams.get("from") ?? undefined;
    const to = request.nextUrl.searchParams.get("to") ?? undefined;
    const summary = await getSalesAnalytics(env, { from, to });

    return ok(summary);
  } catch (error) {
    return fail(error);
  }
}
