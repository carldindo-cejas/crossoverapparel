import { z } from "zod";
import { getDb, type WorkerEnv } from "@/db/client";
import { sqlAll, sqlFirst, sqlRun } from "@/db/raw";
import { AppError } from "@/lib/errors";

const submitRatingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  reviewText: z.string().max(500).optional(),
});

export async function submitRating(
  env: WorkerEnv,
  orderNumber: string,
  rawBody: unknown,
  customerPhone?: string | null
) {
  const db = getDb(env);
  const body = submitRatingSchema.parse(rawBody);

  const order = await sqlFirst<{
    id: string;
    status: string;
    notes: string | null;
    customer_name: string;
    customer_phone: string | null;
  }>(
    db,
    `SELECT o.id, o.status, o.notes, (c.first_name || ' ' || c.last_name) as customer_name, c.phone as customer_phone
     FROM orders o
     INNER JOIN customers c ON c.id = o.customer_id
     WHERE o.order_number = ?
     LIMIT 1`,
    [orderNumber]
  );

  if (!order) {
    throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  // Verify caller phone for guest access
  if (customerPhone !== undefined && customerPhone !== null) {
    const normalize = (p: string) => p.replace(/\D/g, "");
    const stored = normalize(order.customer_phone ?? "");
    if (!stored || normalize(customerPhone) !== stored) {
      throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
    }
  }

  if (order.status !== "delivered") {
    throw new AppError("Can only rate delivered orders", 400, "ORDER_NOT_DELIVERED");
  }

  const existing = await sqlFirst<{ id: number }>(
    db,
    "SELECT id FROM ratings WHERE order_id = ? LIMIT 1",
    [order.id]
  );

  if (existing) {
    throw new AppError("Rating already submitted for this order", 409, "RATING_EXISTS");
  }

  const isCustomOrder = order.notes?.startsWith("Custom order") ? 1 : 0;

  await sqlRun(
    db,
    `INSERT INTO ratings (order_id, customer_name, rating, review_text, is_custom_order)
     VALUES (?, ?, ?, ?, ?)`,
    [order.id, order.customer_name, body.rating, body.reviewText?.trim() || null, isCustomOrder]
  );

  return { orderNumber, rating: body.rating, isCustomOrder };
}

export async function getRating(env: WorkerEnv, orderNumber: string) {
  const db = getDb(env);

  const row = await sqlFirst<{
    id: number;
    rating: number;
    review_text: string | null;
    customer_name: string;
    is_custom_order: number;
    created_at: string;
  }>(
    db,
    `SELECT r.id, r.rating, r.review_text, r.customer_name, r.is_custom_order, r.created_at
     FROM ratings r
     INNER JOIN orders o ON o.id = r.order_id
     WHERE o.order_number = ?
     LIMIT 1`,
    [orderNumber]
  );

  return row;
}

export async function getTestimonials(env: WorkerEnv, limit = 20) {
  const db = getDb(env);

  return sqlAll<{
    id: number;
    rating: number;
    review_text: string | null;
    customer_name: string;
    created_at: string;
  }>(
    db,
    `SELECT id, rating, review_text, customer_name, created_at
     FROM ratings
     WHERE review_text IS NOT NULL AND review_text != ''
     ORDER BY created_at DESC
     LIMIT ?`,
    [limit]
  );
}
