import { z } from "zod";
import { getDb, type WorkerEnv } from "@/db/client";
import { sqlFirst } from "@/db/raw";
import { AppError } from "@/lib/errors";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken } from "@/lib/auth/token";
import type { UserRole } from "@/services/types";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const ownerLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(8)
});

type LoginBody = z.infer<typeof loginSchema>;

type UserRecord = {
  id: string;
  email: string;
  password_hash: string | null;
  role: UserRole;
  full_name: string | null;
  is_active: number;
};

export async function loginOwner(env: WorkerEnv, rawBody: unknown) {
  const body = ownerLoginSchema.parse(rawBody);
  const db = getDb(env);

  const user = await sqlFirst<UserRecord>(
    db,
    `SELECT id, email, password_hash, role, full_name, is_active
     FROM users
     WHERE (email = ? OR full_name = ? OR name = ?) AND role = 'owner'
     LIMIT 1`,
    [body.username.toLowerCase(), body.username, body.username]
  );

  if (!user || !user.password_hash || user.is_active !== 1) {
    throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
  }

  const isValid = await verifyPassword(body.password, user.password_hash);
  if (!isValid) {
    throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
  }

  const token = await createSessionToken(
    { sub: String(user.id), email: user.email, role: user.role },
    env.AUTH_SECRET
  );

  return {
    token,
    user: { id: String(user.id), email: user.email, role: user.role, fullName: user.full_name }
  };
}

export async function loginByRoles(
  env: WorkerEnv,
  roles: Array<"owner" | "designer">,
  rawBody: unknown
) {
  const body = loginSchema.parse(rawBody);
  const db = getDb(env);
  const roleSet = Array.from(new Set(roles));

  if (roleSet.length === 0) {
    throw new AppError("At least one role is required", 500, "AUTH_CONFIG_ERROR");
  }

  const placeholders = roleSet.map(() => "?").join(", ");

  const user = await sqlFirst<UserRecord>(
    db,
    `SELECT id, email, password_hash, role, full_name, is_active FROM users WHERE email = ? AND role IN (${placeholders}) LIMIT 1`,
    [body.email.toLowerCase(), ...roleSet]
  );

  if (!user || !user.password_hash || user.is_active !== 1) {
    throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
  }

  const isValid = await verifyPassword(body.password, user.password_hash);

  if (!isValid) {
    throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
  }

  const token = await createSessionToken(
    {
      sub: String(user.id),
      email: user.email,
      role: user.role
    },
    env.AUTH_SECRET
  );

  return {
    token,
    user: {
      id: String(user.id),
      email: user.email,
      role: user.role,
      fullName: user.full_name
    }
  };
}

export async function loginByRole(env: WorkerEnv, role: "owner" | "designer", rawBody: unknown) {
  return loginByRoles(env, [role], rawBody);
}

export function parseLoginPayload(rawBody: unknown): LoginBody {
  return loginSchema.parse(rawBody);
}
