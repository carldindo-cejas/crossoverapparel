import { z } from "zod";
import { getDb, type WorkerEnv } from "@/db/client";
import { sqlAll, sqlFirst, sqlRun } from "@/db/raw";
import { hashPassword } from "@/lib/auth/password";
import { AppError } from "@/lib/errors";

const createDesignerSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8)
});

const activateSchema = z.object({
  isActive: z.boolean()
});

export async function createDesigner(env: WorkerEnv, rawBody: unknown) {
  const body = createDesignerSchema.parse(rawBody);
  const db = getDb(env);

  const existing = await sqlFirst<{ id: string }>(
    db,
    "SELECT id FROM users WHERE email = ? LIMIT 1",
    [body.email.toLowerCase()]
  );

  if (existing) {
    throw new AppError("An account with this email already exists", 409, "EMAIL_TAKEN");
  }

  const passwordHash = await hashPassword(body.password);
  const id = crypto.randomUUID();

  await sqlRun(
    db,
    `INSERT INTO users (id, email, password_hash, full_name, role, is_active)
     VALUES (?, ?, ?, ?, 'designer', 1)`,
    [id, body.email.toLowerCase(), passwordHash, body.fullName]
  );

  return {
    id,
    email: body.email.toLowerCase(),
    fullName: body.fullName,
    role: "designer",
    isActive: true
  };
}

export async function setStaffActiveState(env: WorkerEnv, userId: string, rawBody: unknown) {
  const body = activateSchema.parse(rawBody);
  const db = getDb(env);

  await sqlRun(
    db,
    "UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND role = 'designer'",
    [body.isActive ? 1 : 0, userId]
  );

  return {
    id: userId,
    isActive: body.isActive
  };
}

export async function listStaffWithStatus(env: WorkerEnv) {
  const db = getDb(env);

  return sqlAll(
    db,
    `SELECT
       u.id,
       u.email,
       u.full_name,
       u.role,
       u.is_active,
       u.updated_at,
       (
         SELECT sp.status
         FROM staff_presence sp
         WHERE sp.user_id = u.id
         ORDER BY sp.started_at DESC
         LIMIT 1
       ) as last_presence_status,
       (
         SELECT sp.started_at
         FROM staff_presence sp
         WHERE sp.user_id = u.id
         ORDER BY sp.started_at DESC
         LIMIT 1
       ) as last_seen_at
     FROM users u
     WHERE u.role = 'designer'
     ORDER BY u.created_at DESC`
  );
}

export async function getDesignerPerformance(env: WorkerEnv) {
  const db = getDb(env);

  return sqlAll(
    db,
    `SELECT
       u.id,
       u.full_name,
       u.email,
       COUNT(da.id) as total_assignments,
       SUM(CASE WHEN da.status = 'completed' THEN 1 ELSE 0 END) as completed_assignments,
       SUM(CASE WHEN da.status IN ('assigned', 'in_progress', 'review') THEN 1 ELSE 0 END) as active_assignments,
       AVG(
         CASE
           WHEN da.completed_at IS NOT NULL
           THEN (julianday(da.completed_at) - julianday(da.created_at)) * 24.0
           ELSE NULL
         END
       ) as avg_completion_hours
     FROM users u
     LEFT JOIN designer_assignments da ON da.designer_user_id = u.id
     WHERE u.role = 'designer'
     GROUP BY u.id, u.full_name, u.email
     ORDER BY completed_assignments DESC, total_assignments DESC`
  );
}
