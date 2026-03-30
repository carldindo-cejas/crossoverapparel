import { getDb, type WorkerEnv } from "@/db/client";
import { sqlFirst } from "@/db/raw";

export async function getAdminDashboardSummary(env: WorkerEnv) {
  const db = getDb(env);

  const totals = await sqlFirst<{
    total_sales_cents: number;
    total_orders: number;
    pending_orders: number;
    in_process_orders: number;
    delivered_orders: number;
  }>(
    db,
    `SELECT
       COALESCE(SUM(CASE WHEN payment_status IN ('paid', 'partial') THEN total_cents ELSE 0 END), 0) as total_sales_cents,
       COUNT(*) as total_orders,
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
       SUM(CASE WHEN status IN ('confirmed', 'in_production', 'ready_to_ship', 'shipped') THEN 1 ELSE 0 END) as in_process_orders,
       SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_orders
     FROM orders`
  );

  return {
    totalSalesCents: totals?.total_sales_cents ?? 0,
    totalOrders: totals?.total_orders ?? 0,
    pendingOrders: totals?.pending_orders ?? 0,
    inProcessOrders: totals?.in_process_orders ?? 0,
    deliveredOrders: totals?.delivered_orders ?? 0
  };
}
