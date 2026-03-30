import { z } from "zod";
import { getDb, type WorkerEnv } from "@/db/client";
import { sqlAll, sqlFirst } from "@/db/raw";

const rangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional()
});

function buildRange(raw: { from?: string; to?: string }) {
  const parsed = rangeSchema.parse(raw);
  return {
    from: parsed.from ?? "1970-01-01T00:00:00.000Z",
    to: parsed.to ?? "2999-12-31T23:59:59.000Z"
  };
}

export async function getSalesAnalytics(env: WorkerEnv, rawRange: { from?: string; to?: string }) {
  const db = getDb(env);
  const { from, to } = buildRange(rawRange);

  const totalSales = await sqlFirst<{ total_cents: number }>(
    db,
    `SELECT COALESCE(SUM(total_cents), 0) as total_cents
     FROM orders
     WHERE payment_status IN ('paid', 'partial')
       AND placed_at BETWEEN ? AND ?`,
    [from, to]
  );

  const bestSelling = await sqlAll(
    db,
    `SELECT
       oi.product_id,
       oi.product_name_snapshot as product_name,
       SUM(oi.quantity) as total_quantity,
       SUM(oi.line_total_cents) as total_revenue_cents
     FROM order_items oi
     INNER JOIN orders o ON o.id = oi.order_id
     WHERE o.status NOT IN ('cancelled', 'refunded')
       AND o.placed_at BETWEEN ? AND ?
     GROUP BY oi.product_id, oi.product_name_snapshot
     ORDER BY total_quantity DESC
     LIMIT 10`,
    [from, to]
  );

  const byDate = await sqlAll(
    db,
    `SELECT
       DATE(placed_at) as sales_date,
       COUNT(*) as order_count,
       COALESCE(SUM(total_cents), 0) as total_sales_cents
     FROM orders
     WHERE payment_status IN ('paid', 'partial')
       AND placed_at BETWEEN ? AND ?
     GROUP BY DATE(placed_at)
     ORDER BY sales_date ASC`,
    [from, to]
  );

  return {
    totalSalesCents: totalSales?.total_cents ?? 0,
    bestSellingProducts: bestSelling,
    salesByDate: byDate
  };
}

export async function getSalesHistory(env: WorkerEnv, rawRange: { from?: string; to?: string }) {
  const db = getDb(env);
  const { from, to } = buildRange(rawRange);

  return sqlAll(
    db,
    `SELECT
       DATE(placed_at) as date,
       COUNT(*) as orders,
       COALESCE(SUM(total_cents), 0) as revenue_cents
     FROM orders
     WHERE placed_at BETWEEN ? AND ?
     GROUP BY DATE(placed_at)
     ORDER BY date ASC`,
    [from, to]
  );
}
