import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { requireAuth } from "@/lib/auth/guard";
import { getAdminDashboardSummary } from "@/services/dashboard.service";
import { getSalesAnalytics } from "@/services/sales.service";

export async function GET(request: NextRequest) {
  try {
    const env = getWorkerEnv();
    await requireAuth(request, env.AUTH_SECRET, ["owner"]);

    const from = request.nextUrl.searchParams.get("from") ?? undefined;
    const to = request.nextUrl.searchParams.get("to") ?? undefined;

    const [summary, sales] = await Promise.all([
      getAdminDashboardSummary(env),
      getSalesAnalytics(env, { from, to })
    ]);

    return ok({
      ...summary,
      bestSellingProducts: sales.bestSellingProducts,
      salesByDate: sales.salesByDate
    });
  } catch (error) {
    return fail(error);
  }
}
