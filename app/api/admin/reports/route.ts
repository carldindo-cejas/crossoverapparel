import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { requireAuth } from "@/lib/auth/guard";
import {
  getSalesHistory,
  getOrderStatusBreakdown,
  getCategoryRevenue,
  getMonthlyTrends,
  getTopCustomers,
} from "@/services/sales.service";
import { getDesignerPerformance } from "@/services/staff-admin.service";

export async function GET(request: NextRequest) {
  try {
    const env = getWorkerEnv();
    await requireAuth(request, env.AUTH_SECRET, ["owner"]);

    const from = request.nextUrl.searchParams.get("from") ?? undefined;
    const to = request.nextUrl.searchParams.get("to") ?? undefined;

    const [
      salesHistory,
      designerPerformance,
      orderStatusBreakdown,
      categoryRevenue,
      monthlyTrends,
      topCustomers,
    ] = await Promise.all([
      getSalesHistory(env, { from, to }),
      getDesignerPerformance(env),
      getOrderStatusBreakdown(env),
      getCategoryRevenue(env, { from, to }),
      getMonthlyTrends(env),
      getTopCustomers(env, { from, to }),
    ]);

    return ok({
      salesHistory,
      designerPerformance,
      orderStatusBreakdown,
      categoryRevenue,
      monthlyTrends,
      topCustomers,
    });
  } catch (error) {
    return fail(error);
  }
}
