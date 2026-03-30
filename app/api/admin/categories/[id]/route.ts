import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { getWorkerEnv } from "@/lib/env";
import { requireAuth } from "@/lib/auth/guard";
import { deleteCategory, updateCategory } from "@/services/category.service";

function parseCategoryId(rawId: string) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError("Invalid category id", 422, "INVALID_CATEGORY_ID");
  }
  return id;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const env = getWorkerEnv();
    await requireAuth(request, env.AUTH_SECRET, ["owner"]);
    const { id } = await params;
    const categoryId = parseCategoryId(id);
    const body = await request.json();
    const result = await updateCategory(env, categoryId, body);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const env = getWorkerEnv();
    await requireAuth(request, env.AUTH_SECRET, ["owner"]);
    const { id } = await params;
    const categoryId = parseCategoryId(id);
    const result = await deleteCategory(env, categoryId);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
