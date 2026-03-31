import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { requireAuth } from "@/lib/auth/guard";
import { getDb, type WorkerEnv } from "@/db/client";
import { sqlRun, sqlFirst } from "@/db/raw";
import { hashPassword } from "@/lib/auth/password";
import { AppError } from "@/lib/errors";
import { z } from "zod";

const schema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const env = getWorkerEnv();
    await requireAuth(request, env.AUTH_SECRET, ["owner"]);
    const { id } = await params;
    const body = schema.parse(await request.json());
    const db = getDb(env as WorkerEnv);

    const user = await sqlFirst<{ id: string }>(
      db,
      "SELECT id FROM users WHERE id = ? AND role = 'designer' LIMIT 1",
      [id]
    );

    if (!user) {
      throw new AppError("Designer not found", 404, "NOT_FOUND");
    }

    const hashed = await hashPassword(body.password);

    await sqlRun(
      db,
      "UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [hashed, id]
    );

    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}
