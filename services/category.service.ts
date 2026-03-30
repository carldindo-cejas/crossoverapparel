import { z } from "zod";
import { getDb, type WorkerEnv } from "@/db/client";
import { sqlAll, sqlRun } from "@/db/raw";
import { AppError } from "@/lib/errors";

const createCategorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  parentId: z.number().int().positive().optional(),
  isActive: z.boolean().default(true)
});

const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  parentId: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional()
});

export async function createCategory(env: WorkerEnv, rawBody: unknown) {
  const body = createCategorySchema.parse(rawBody);
  const db = getDb(env);

  await sqlRun(
    db,
    "INSERT INTO categories (name, slug, parent_id, is_active) VALUES (?, ?, ?, ?)",
    [body.name, body.slug, body.parentId ?? null, body.isActive ? 1 : 0]
  );

  const categories = await sqlAll<{ id: number }>(db, "SELECT id FROM categories WHERE slug = ? LIMIT 1", [
    body.slug
  ]);

  return {
    id: categories[0]?.id,
    name: body.name,
    slug: body.slug
  };
}

export async function updateCategory(env: WorkerEnv, categoryId: number, rawBody: unknown) {
  const body = updateCategorySchema.parse(rawBody);
  const sets: string[] = [];
  const params: Array<string | number | null> = [];

  const map: Record<string, unknown> = {
    name: body.name,
    slug: body.slug,
    parent_id: body.parentId,
    is_active: typeof body.isActive === "boolean" ? (body.isActive ? 1 : 0) : undefined
  };

  for (const [column, value] of Object.entries(map)) {
    if (typeof value !== "undefined") {
      sets.push(`${column} = ?`);
      params.push(value as string | number | null);
    }
  }

  if (sets.length === 0) {
    throw new AppError("No fields supplied for category update", 400, "EMPTY_UPDATE");
  }

  const db = getDb(env);
  params.push(categoryId);

  await sqlRun(
    db,
    `UPDATE categories SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    params
  );

  return { id: categoryId };
}

export async function deleteCategory(env: WorkerEnv, categoryId: number) {
  const db = getDb(env);
  await sqlRun(db, "DELETE FROM categories WHERE id = ?", [categoryId]);
  return { id: categoryId, deleted: true };
}
