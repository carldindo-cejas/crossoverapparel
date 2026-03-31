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
     WHERE status NOT IN ('cancelled', 'refunded')
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
     WHERE status NOT IN ('cancelled', 'refunded')
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

/* ── Advanced Analytics ── */

export async function getOrderStatusBreakdown(env: WorkerEnv) {
  const db = getDb(env);
  return sqlAll(
    db,
    `SELECT status, COUNT(*) as count
     FROM orders
     GROUP BY status
     ORDER BY count DESC`
  );
}

export async function getCategoryRevenue(env: WorkerEnv, rawRange: { from?: string; to?: string }) {
  const db = getDb(env);
  const { from, to } = buildRange(rawRange);
  return sqlAll(
    db,
    `SELECT
       COALESCE(p.category_id, 0) as category_id,
       COALESCE(c.name, 'Uncategorized') as category_name,
       SUM(oi.line_total_cents) as revenue_cents,
       SUM(oi.quantity) as total_quantity
     FROM order_items oi
     INNER JOIN orders o ON o.id = oi.order_id
     LEFT JOIN products p ON p.id = oi.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE o.status NOT IN ('cancelled', 'refunded')
       AND o.placed_at BETWEEN ? AND ?
     GROUP BY COALESCE(p.category_id, 0), COALESCE(c.name, 'Uncategorized')
     ORDER BY revenue_cents DESC`,
    [from, to]
  );
}

export async function getMonthlyTrends(env: WorkerEnv) {
  const db = getDb(env);
  return sqlAll(
    db,
    `SELECT
       strftime('%Y-%m', placed_at) as month,
       COUNT(*) as order_count,
       COALESCE(SUM(total_cents), 0) as revenue_cents,
       ROUND(COALESCE(AVG(total_cents), 0)) as avg_order_cents
     FROM orders
     WHERE status NOT IN ('cancelled', 'refunded')
     GROUP BY strftime('%Y-%m', placed_at)
     ORDER BY month ASC
     LIMIT 12`
  );
}

export async function getTopCustomers(env: WorkerEnv, rawRange: { from?: string; to?: string }) {
  const db = getDb(env);
  const { from, to } = buildRange(rawRange);
  return sqlAll(
    db,
    `SELECT
       o.customer_id,
       cu.first_name || ' ' || cu.last_name as customer_name,
       COUNT(*) as order_count,
       COALESCE(SUM(o.total_cents), 0) as total_spent_cents
     FROM orders o
     LEFT JOIN customers cu ON cu.id = o.customer_id
     WHERE o.status NOT IN ('cancelled', 'refunded')
       AND o.placed_at BETWEEN ? AND ?
     GROUP BY o.customer_id
     ORDER BY total_spent_cents DESC
     LIMIT 10`,
    [from, to]
  );
}

export async function getPaymentMethodStats(env: WorkerEnv) {
  const db = getDb(env);
  return sqlAll(
    db,
    `SELECT
       COALESCE(
         (SELECT oc.field_value FROM order_customizations oc
          WHERE oc.order_item_id IN (SELECT oi2.id FROM order_items oi2 WHERE oi2.order_id = o.id)
            AND oc.field_name = 'paymentMethod'
          LIMIT 1),
         'Unknown'
       ) as payment_method,
       COUNT(*) as order_count,
       COALESCE(SUM(o.total_cents), 0) as revenue_cents
     FROM orders o
     WHERE o.status NOT IN ('cancelled', 'refunded')
     GROUP BY payment_method
     ORDER BY order_count DESC`
  );
}
