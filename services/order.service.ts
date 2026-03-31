import { z } from "zod";
import { getDb, type WorkerEnv } from "@/db/client";
import { sqlAll, sqlFirst, sqlRun } from "@/db/raw";
import { AppError } from "@/lib/errors";
import { publishRealtimeEvent } from "@/services/realtime-publisher.service";
import type { OrderStatus } from "@/services/types";

const orderItemSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().optional(),
  quantity: z.number().int().positive(),
  customizations: z
    .array(
      z.object({
        customizationType: z.enum(["text", "image", "embroidery", "print", "other"]),
        fieldName: z.string().min(1),
        fieldValue: z.string().min(1),
        additionalCostCents: z.number().int().min(0).default(0)
      })
    )
    .optional()
    .default([])
});

const createOrderSchema = z.object({
  customer: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    billingAddress: z.record(z.string(), z.unknown()).optional(),
    shippingAddress: z.record(z.string(), z.unknown()).optional()
  }),
  items: z.array(orderItemSchema).min(1),
  shippingCents: z.number().int().min(0).default(0),
  taxCents: z.number().int().min(0).default(0),
  discountCents: z.number().int().min(0).default(0),
  notes: z.string().optional()
});

const assignDesignerSchema = z.object({
  designerUserId: z.string().uuid(),
  dueAt: z.string().datetime().optional(),
  notes: z.string().optional()
});

const updateStatusSchema = z.object({
  status: z.enum([
    "pending",
    "confirmed",
    "in_production",
    "ready_to_ship",
    "shipped",
    "delivered",
    "cancelled",
    "refunded"
  ]),
  reason: z.string().optional()
});

const addNoteSchema = z.object({
  note: z.string().min(1)
});

type ProductLookup = {
  product_id: number;
  product_name: string;
  base_price_cents: number;
  variant_id: number | null;
  variant_title: string | null;
  additional_price_cents: number | null;
};

type CreateOrderInput = z.infer<typeof createOrderSchema>;

function createOrderNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0");
  return `CO-${stamp}-${random}`;
}

export function parseCreateOrderInput(rawBody: unknown): CreateOrderInput {
  return createOrderSchema.parse(rawBody);
}

export async function createOrder(env: WorkerEnv, rawBody: unknown) {
  const db = getDb(env);
  const input = createOrderSchema.parse(rawBody);
  const orderId = crypto.randomUUID();
  const customerId = crypto.randomUUID();
  const orderNumber = createOrderNumber();

  const existingCustomer = await sqlFirst<{ id: string }>(
    db,
    "SELECT id FROM customers WHERE email = ? LIMIT 1",
    [input.customer.email.toLowerCase()]
  );

  const customerRowId = existingCustomer?.id ?? customerId;

  if (existingCustomer) {
    await sqlRun(
      db,
      `UPDATE customers
       SET first_name = ?, last_name = ?, phone = ?, billing_address_json = ?, shipping_address_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        input.customer.firstName,
        input.customer.lastName,
        input.customer.phone ?? null,
        input.customer.billingAddress ? JSON.stringify(input.customer.billingAddress) : null,
        input.customer.shippingAddress ? JSON.stringify(input.customer.shippingAddress) : null,
        customerRowId
      ]
    );
  } else {
    await sqlRun(
      db,
      `INSERT INTO customers (id, first_name, last_name, email, phone, billing_address_json, shipping_address_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        customerRowId,
        input.customer.firstName,
        input.customer.lastName,
        input.customer.email.toLowerCase(),
        input.customer.phone ?? null,
        input.customer.billingAddress ? JSON.stringify(input.customer.billingAddress) : null,
        input.customer.shippingAddress ? JSON.stringify(input.customer.shippingAddress) : null
      ]
    );
  }

  await sqlRun(
    db,
    `INSERT INTO orders (id, order_number, customer_id, status, payment_status, subtotal_cents, tax_cents, shipping_cents, discount_cents, total_cents, notes)
     VALUES (?, ?, ?, 'pending', 'unpaid', 0, ?, ?, ?, 0, ?)`,
    [
      orderId,
      orderNumber,
      customerRowId,
      input.taxCents,
      input.shippingCents,
      input.discountCents,
      input.notes ?? null
    ]
  );

  let subtotalCents = 0;

  for (const item of input.items) {
    const lookup = await sqlFirst<ProductLookup>(
      db,
      `SELECT
         p.id as product_id,
         p.name as product_name,
         p.base_price_cents,
         v.id as variant_id,
         v.title as variant_title,
         v.additional_price_cents
       FROM products p
       LEFT JOIN product_variants v ON v.id = ? AND v.product_id = p.id
       WHERE p.id = ? AND p.status = 'active'`,
      [item.variantId ?? null, item.productId]
    );

    if (!lookup) {
      throw new AppError(`Product ${item.productId} is not available`, 404, "PRODUCT_NOT_FOUND");
    }

    const unitPrice = lookup.base_price_cents + (lookup.additional_price_cents ?? 0);
    const lineTotal = unitPrice * item.quantity;
    subtotalCents += lineTotal;

    const inserted = await sqlRun(
      db,
      `INSERT INTO order_items (order_id, product_id, variant_id, product_name_snapshot, variant_title_snapshot, quantity, unit_price_cents, line_total_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        lookup.product_id,
        lookup.variant_id,
        lookup.product_name,
        lookup.variant_title,
        item.quantity,
        unitPrice,
        lineTotal
      ]
    );

    const orderItemId = inserted.meta.last_row_id;

    for (const customization of item.customizations) {
      await sqlRun(
        db,
        `INSERT INTO order_customizations (order_item_id, customization_type, field_name, field_value, additional_cost_cents)
         VALUES (?, ?, ?, ?, ?)`,
        [
          orderItemId,
          customization.customizationType,
          customization.fieldName,
          customization.fieldValue,
          customization.additionalCostCents
        ]
      );

      subtotalCents += customization.additionalCostCents;
    }
  }

  const totalCents = subtotalCents + input.taxCents + input.shippingCents - input.discountCents;

  await sqlRun(
    db,
    `UPDATE orders
     SET subtotal_cents = ?, total_cents = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [subtotalCents, totalCents, orderId]
  );

  await sqlRun(
    db,
    "INSERT INTO order_status_logs (order_id, previous_status, new_status, reason) VALUES (?, NULL, 'pending', ?)",
    [orderId, "Order created"]
  );

  await publishRealtimeEvent(env, {
    type: "order.created",
    payload: {
      orderId,
      orderNumber,
      totalCents,
    }
  });

  await publishRealtimeEvent(env, {
    type: "dashboard.updated",
    payload: {
      source: "order-created",
      orderId,
    }
  });

  return {
    orderId,
    orderNumber,
    totalCents,
    status: "pending"
  };
}

export async function getOrderByNumber(env: WorkerEnv, orderNumber: string) {
  const db = getDb(env);

  const order = await sqlFirst<{
    id: string;
    order_number: string;
    status: OrderStatus;
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
     WHERE o.order_number = ?
     LIMIT 1`,
    [orderNumber]
  );

  if (!order) {
    throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  const items = await sqlAll(
    db,
    `SELECT id, product_id, variant_id, product_name_snapshot, variant_title_snapshot, quantity, unit_price_cents, line_total_cents
     FROM order_items
     WHERE order_id = ?`,
    [order.id]
  );

  const files = await sqlAll(
    db,
    `SELECT id, r2_key, file_name, mime_type, size_bytes, created_at
     FROM order_files
     WHERE order_id = ?
     ORDER BY created_at DESC`,
    [order.id]
  );

  return {
    ...order,
    items,
    files
  };
}

export async function listOrders(env: WorkerEnv, limit = 50, offset = 0) {
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
       la.designer_user_id as assignment_designer_id,
       u.full_name as assignment_designer_name
     FROM orders o
     INNER JOIN customers c ON c.id = o.customer_id
     LEFT JOIN (
       SELECT da1.order_id, da1.designer_user_id
       FROM designer_assignments da1
       INNER JOIN (
         SELECT order_id, MAX(created_at) as max_created_at
         FROM designer_assignments
         GROUP BY order_id
       ) latest ON latest.order_id = da1.order_id AND latest.max_created_at = da1.created_at
     ) la ON la.order_id = o.id
     LEFT JOIN users u ON u.id = la.designer_user_id
     ORDER BY o.placed_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
}

export async function assignDesigner(
  env: WorkerEnv,
  orderId: string,
  assignedBy: string,
  rawBody: unknown
) {
  const db = getDb(env);
  const body = assignDesignerSchema.parse(rawBody);

  const order = await sqlFirst<{ id: string }>(db, "SELECT id FROM orders WHERE id = ? LIMIT 1", [
    orderId
  ]);

  if (!order) {
    throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  const designer = await sqlFirst<{ id: string }>(
    db,
    "SELECT id FROM users WHERE id = ? AND role = 'designer' AND is_active = 1 LIMIT 1",
    [body.designerUserId]
  );

  if (!designer) {
    throw new AppError("Designer not found", 404, "DESIGNER_NOT_FOUND");
  }

  await sqlRun(
    db,
    `INSERT INTO designer_assignments (order_id, designer_user_id, assigned_by, status, due_at, notes)
     VALUES (?, ?, ?, 'assigned', ?, ?)`,
    [orderId, body.designerUserId, assignedBy, body.dueAt ?? null, body.notes ?? null]
  );

  const assignedOrder = await sqlFirst<{ order_number: string }>(
    db,
    "SELECT order_number FROM orders WHERE id = ? LIMIT 1",
    [orderId]
  );

  await publishRealtimeEvent(env, {
    type: "assignment.updated",
    userId: body.designerUserId,
    payload: {
      orderId,
      orderNumber: assignedOrder?.order_number ?? "",
      designerUserId: body.designerUserId,
      assignedBy
    }
  });

  return { orderId, designerUserId: body.designerUserId };
}

export async function updateOrderStatus(
  env: WorkerEnv,
  orderId: string,
  changedBy: string,
  rawBody: unknown
) {
  const db = getDb(env);
  const body = updateStatusSchema.parse(rawBody);

  const current = await sqlFirst<{ status: OrderStatus }>(
    db,
    "SELECT status FROM orders WHERE id = ? LIMIT 1",
    [orderId]
  );

  if (!current) {
    throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  await sqlRun(
    db,
    "UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [body.status, orderId]
  );

  // Auto-complete designer assignments when order is delivered
  if (body.status === "delivered") {
    await sqlRun(
      db,
      `UPDATE designer_assignments
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP
       WHERE order_id = ? AND status != 'completed'`,
      [orderId]
    );
  }

  await sqlRun(
    db,
    `INSERT INTO order_status_logs (order_id, previous_status, new_status, changed_by, reason)
     VALUES (?, ?, ?, ?, ?)`,
    [orderId, current.status, body.status, changedBy, body.reason ?? null]
  );

  const changedByUser = await sqlFirst<{ role: string; full_name: string }>(db, "SELECT role, full_name FROM users WHERE id = ? LIMIT 1", [changedBy]);

  await publishRealtimeEvent(env, {
    type: "order.status.updated",
    payload: {
      orderId,
      orderNumber: (await sqlFirst<{ order_number: string }>(db, "SELECT order_number FROM orders WHERE id = ? LIMIT 1", [orderId]))?.order_number ?? "",
      previousStatus: current.status,
      newStatus: body.status,
      changedBy,
      changedByRole: changedByUser?.role ?? "unknown",
      changedByName: changedByUser?.full_name ?? "Unknown"
    }
  });

  await publishRealtimeEvent(env, {
    type: "dashboard.updated",
    payload: {
      source: "order-status",
      orderId
    }
  });

  return { orderId, previousStatus: current.status, newStatus: body.status };
}

export async function addOrderNote(env: WorkerEnv, orderId: string, authorId: string, rawBody: unknown) {
  const db = getDb(env);
  const body = addNoteSchema.parse(rawBody);
  const now = new Date().toISOString();
  const line = `[${now}] (${authorId}) ${body.note}`;

  const order = await sqlFirst<{ id: string }>(db, "SELECT id FROM orders WHERE id = ? LIMIT 1", [
    orderId
  ]);

  if (!order) {
    throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  await sqlRun(
    db,
    `UPDATE orders
     SET notes = CASE
       WHEN notes IS NULL OR notes = '' THEN ?
       ELSE notes || '\n' || ?
     END,
     updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [line, line, orderId]
  );

  await publishRealtimeEvent(env, {
    type: "order.note.added",
    payload: {
      orderId,
      authorId
    }
  });

  return { orderId, note: line };
}
