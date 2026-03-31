import { z } from "zod";
import { getDb, type WorkerEnv } from "@/db/client";
import { sqlAll, sqlFirst, sqlRun } from "@/db/raw";
import { AppError } from "@/lib/errors";

const createProductSchema = z.object({
  categoryId: z.number().int().positive().optional(),
  sku: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  basePriceCents: z.number().int().min(0),
  currency: z.string().length(3).default("PHP"),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  isBanner: z.boolean().default(false)
});

const updateProductSchema = z.object({
  categoryId: z.number().int().positive().nullable().optional(),
  sku: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  basePriceCents: z.number().int().min(0).optional(),
  currency: z.string().length(3).optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  isBanner: z.boolean().optional()
});

// Fixed pricing per product type (in centavos)
export const FIXED_PRICES: Record<string, number> = {
  jersey: 34900,
  jerseys: 34900,
  sando: 34900,
  tshirt: 39900,
  tshirts: 39900,
  "t-shirt": 39900,
  poloshirt: 44900,
  poloshirts: 44900,
  "polo shirts": 44900,
  warmer: 54900,
  warmers: 54900,
};

export function getFixedPriceByCategoryName(categoryName: string | null): number | null {
  if (!categoryName) return null;
  return FIXED_PRICES[categoryName.toLowerCase()] ?? null;
}

export async function createProduct(env: WorkerEnv, createdBy: string, rawBody: unknown) {
  const body = createProductSchema.parse(rawBody);
  const db = getDb(env);

  await sqlRun(
    db,
    `INSERT INTO products
      (category_id, sku, name, slug, description, base_price_cents, currency, status, created_by, is_banner)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      body.categoryId ?? null,
      body.sku,
      body.name,
      body.slug,
      body.description ?? null,
      body.basePriceCents,
      body.currency.toUpperCase(),
      body.status,
      createdBy,
      body.isBanner ? 1 : 0
    ]
  );

  const product = await sqlFirst<{ id: number }>(db, "SELECT id FROM products WHERE sku = ? LIMIT 1", [
    body.sku
  ]);

  return {
    id: product?.id,
    sku: body.sku,
    name: body.name
  };
}

export async function updateProduct(env: WorkerEnv, productId: number, rawBody: unknown) {
  const body = updateProductSchema.parse(rawBody);
  const db = getDb(env);
  const sets: string[] = [];
  const params: Array<string | number | null> = [];

  const map: Record<string, unknown> = {
    category_id: body.categoryId,
    sku: body.sku,
    name: body.name,
    slug: body.slug,
    description: body.description,
    base_price_cents: body.basePriceCents,
    currency: body.currency ? body.currency.toUpperCase() : undefined,
    status: body.status,
    is_banner: typeof body.isBanner === "boolean" ? (body.isBanner ? 1 : 0) : undefined
  };

  for (const [column, value] of Object.entries(map)) {
    if (typeof value !== "undefined") {
      sets.push(`${column} = ?`);
      params.push(value as string | number | null);
    }
  }

  if (sets.length === 0) {
    throw new AppError("No fields supplied for update", 400, "EMPTY_UPDATE");
  }

  params.push(productId);

  await sqlRun(
    db,
    `UPDATE products SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    params
  );

  return { id: productId };
}

export async function deleteProduct(env: WorkerEnv, productId: number) {
  const db = getDb(env);
  await sqlRun(db, "DELETE FROM products WHERE id = ?", [productId]);
  return { id: productId, deleted: true };
}

export async function getProducts(env: WorkerEnv) {
  const db = getDb(env);
  return sqlAll(
    db,
    `SELECT p.id, p.sku, p.name, p.slug, p.description, p.base_price_cents, p.currency, p.status, p.created_at,
            p.is_banner,
            c.id as category_id, c.name as category_name,
            pi.r2_key as image_url,
            COALESCE(pr.avg_rating, 0) as rating
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
     LEFT JOIN (
       SELECT oi.product_id, ROUND(AVG(r.rating), 1) as avg_rating
       FROM ratings r
       INNER JOIN orders o ON o.id = r.order_id
       INNER JOIN order_items oi ON oi.order_id = o.id
       WHERE oi.product_id IS NOT NULL
       GROUP BY oi.product_id
     ) pr ON pr.product_id = p.id
     ORDER BY p.created_at DESC`
  );
}

export async function getCategories(env: WorkerEnv) {
  const db = getDb(env);
  return sqlAll(
    db,
    "SELECT id, name, slug, parent_id, is_active, created_at, updated_at FROM categories ORDER BY name ASC"
  );
}

export async function uploadProductImage(
  env: WorkerEnv,
  productId: number,
  file: File
) {
  const db = getDb(env);

  const product = await sqlFirst<{ id: number }>(db, "SELECT id FROM products WHERE id = ?", [productId]);
  if (!product) {
    throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
  }

  const bucket = env.PRODUCT_IMAGES;
  if (!bucket) {
    throw new AppError("PRODUCT_IMAGES R2 bucket is not configured", 500, "R2_NOT_CONFIGURED");
  }

  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `products/${productId}/${crypto.randomUUID()}-${sanitized}`;
  const bytes = await file.arrayBuffer();

  await bucket.put(key, bytes, {
    httpMetadata: { contentType: file.type || "image/jpeg" }
  });

  // Mark existing images as non-primary
  await sqlRun(db, "UPDATE product_images SET is_primary = 0 WHERE product_id = ?", [productId]);

  await sqlRun(
    db,
    `INSERT INTO product_images (product_id, r2_key, alt_text, sort_order, is_primary)
     VALUES (?, ?, ?, 0, 1)`,
    [productId, key, `${product.id} product image`]
  );

  return { productId, key };
}
