import { getDb, type WorkerEnv } from "@/db/client";
import { sqlAll, sqlFirst, sqlRun } from "@/db/raw";
import { AppError } from "@/lib/errors";

/** List all active orders for the designer panel (excludes cancelled / refunded). */
export async function listActiveOrders(env: WorkerEnv) {
  const db = getDb(env);

  return sqlAll(
    db,
    `SELECT
       o.id,
       o.order_number,
       o.status,
       o.payment_status,
       o.total_cents,
       o.currency,
       o.placed_at,
       (c.first_name || ' ' || c.last_name) as customer_name,
       c.email as customer_email
     FROM orders o
     INNER JOIN customers c ON c.id = o.customer_id
     WHERE o.status NOT IN ('cancelled', 'refunded')
     ORDER BY o.placed_at DESC`
  );
}

/** Get full order details by order number (no assignment restriction). */
export async function getOrderDetails(env: WorkerEnv, orderNumber: string) {
  const db = getDb(env);

  const order = await sqlFirst<{
    id: string;
    order_number: string;
    status: string;
    payment_status: string;
    subtotal_cents: number;
    tax_cents: number;
    shipping_cents: number;
    discount_cents: number;
    total_cents: number;
    currency: string;
    placed_at: string;
    notes: string | null;
    customer_email: string;
    customer_name: string;
  }>(
    db,
    `SELECT
       o.id,
       o.order_number,
       o.status,
       o.payment_status,
       o.subtotal_cents,
       o.tax_cents,
       o.shipping_cents,
       o.discount_cents,
       o.total_cents,
       o.currency,
       o.placed_at,
       o.notes,
       c.email as customer_email,
       (c.first_name || ' ' || c.last_name) as customer_name
     FROM orders o
     INNER JOIN customers c ON c.id = o.customer_id
     WHERE o.order_number = ?
     LIMIT 1`,
    [orderNumber]
  );

  if (!order) {
    throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  const [items, files, history, customizations] = await Promise.all([
    sqlAll(
      db,
      `SELECT id, product_name_snapshot, quantity, unit_price_cents, line_total_cents
       FROM order_items WHERE order_id = ?`,
      [order.id]
    ),
    sqlAll(
      db,
      `SELECT id, r2_key, file_name, mime_type, size_bytes, created_at
       FROM order_files WHERE order_id = ? ORDER BY created_at DESC`,
      [order.id]
    ),
    sqlAll(
      db,
      `SELECT id, previous_status, new_status, reason, changed_at
       FROM order_status_logs WHERE order_id = ? ORDER BY changed_at DESC`,
      [order.id]
    ),
    sqlAll(
      db,
      `SELECT oc.id, oc.customization_type, oc.field_name, oc.field_value, oc.order_item_id
       FROM order_customizations oc
       INNER JOIN order_items oi ON oi.id = oc.order_item_id
       WHERE oi.order_id = ?`,
      [order.id]
    )
  ]);

  return { ...order, items, files, history, customizations };
}

/** Get order id from order_number (no assignment restriction). */
export async function getOrderIdByNumber(env: WorkerEnv, orderNumber: string) {
  const db = getDb(env);

  const order = await sqlFirst<{ id: string }>(
    db,
    "SELECT id FROM orders WHERE order_number = ? LIMIT 1",
    [orderNumber]
  );

  if (!order) {
    throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  return order.id;
}

/** @deprecated use listActiveOrders instead */
export async function listAssignedOrders(env: WorkerEnv, designerUserId: string) {
  const db = getDb(env);

  return sqlAll(
    db,
    `SELECT
       o.id,
       o.order_number,
       o.status,
       o.payment_status,
       o.total_cents,
       o.currency,
       o.placed_at,
       c.email as customer_email,
       (c.first_name || ' ' || c.last_name) as customer_name,
       da.status as assignment_status,
       da.due_at,
       da.updated_at as assignment_updated_at
     FROM designer_assignments da
     INNER JOIN orders o ON o.id = da.order_id
     INNER JOIN customers c ON c.id = o.customer_id
     WHERE da.designer_user_id = ?
     ORDER BY o.placed_at DESC`,
    [designerUserId]
  );
}

export async function getAssignedOrderDetails(
  env: WorkerEnv,
  designerUserId: string,
  orderNumber: string
) {
  const db = getDb(env);

  const order = await sqlFirst<{
    id: string;
    order_number: string;
    status: string;
    payment_status: string;
    subtotal_cents: number;
    tax_cents: number;
    shipping_cents: number;
    discount_cents: number;
    total_cents: number;
    placed_at: string;
    notes: string | null;
    customer_email: string;
    customer_name: string;
  }>(
    db,
    `SELECT
       o.id,
       o.order_number,
       o.status,
       o.payment_status,
       o.subtotal_cents,
       o.tax_cents,
       o.shipping_cents,
       o.discount_cents,
       o.total_cents,
       o.placed_at,
       o.notes,
       c.email as customer_email,
       (c.first_name || ' ' || c.last_name) as customer_name
     FROM orders o
     INNER JOIN customers c ON c.id = o.customer_id
     INNER JOIN designer_assignments da ON da.order_id = o.id
     WHERE o.order_number = ? AND da.designer_user_id = ?
     LIMIT 1`,
    [orderNumber, designerUserId]
  );

  if (!order) {
    throw new AppError("Assigned order not found", 404, "ORDER_NOT_FOUND");
  }

  const [items, files, history] = await Promise.all([
    sqlAll(
      db,
      `SELECT id, product_id, variant_id, product_name_snapshot, variant_title_snapshot, quantity, unit_price_cents, line_total_cents
       FROM order_items
       WHERE order_id = ?`,
      [order.id]
    ),
    sqlAll(
      db,
      `SELECT id, r2_key, file_name, mime_type, size_bytes, created_at
       FROM order_files
       WHERE order_id = ?
       ORDER BY created_at DESC`,
      [order.id]
    ),
    sqlAll(
      db,
      `SELECT
         id,
         previous_status,
         new_status,
         changed_by,
         reason,
         changed_at
       FROM order_status_logs
       WHERE order_id = ?
       ORDER BY changed_at DESC`,
      [order.id]
    )
  ]);

  return {
    ...order,
    items,
    files,
    history
  };
}

export async function ensureDesignerHasOrder(env: WorkerEnv, designerUserId: string, orderId: string) {
  const db = getDb(env);

  const assignment = await sqlFirst<{ id: number }>(
    db,
    `SELECT id FROM designer_assignments WHERE designer_user_id = ? AND order_id = ? LIMIT 1`,
    [designerUserId, orderId]
  );

  if (!assignment) {
    throw new AppError("Order is not assigned to this designer", 403, "FORBIDDEN_ORDER");
  }
}

export async function getAssignedOrderIdByNumber(
  env: WorkerEnv,
  designerUserId: string,
  orderNumber: string
) {
  const db = getDb(env);

  const order = await sqlFirst<{ id: string }>(
    db,
    `SELECT o.id
     FROM orders o
     INNER JOIN designer_assignments da ON da.order_id = o.id
     WHERE o.order_number = ? AND da.designer_user_id = ?
     LIMIT 1`,
    [orderNumber, designerUserId]
  );

  if (!order) {
    throw new AppError("Order is not assigned to this designer", 403, "FORBIDDEN_ORDER");
  }

  return order.id;
}
