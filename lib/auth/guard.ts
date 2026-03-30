import type { NextRequest } from "next/server";
import { AppError } from "@/lib/errors";
import { verifySessionToken, type SessionPayload } from "@/lib/auth/token";

export async function requireAuth(
  request: NextRequest,
  secret: string,
  roles?: SessionPayload["role"][]
): Promise<SessionPayload> {
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const cookieToken = request.cookies.get("ca_token")?.value ?? null;
  const token = bearer || cookieToken;

  if (!token) {
    throw new AppError("Authentication required", 401, "AUTH_REQUIRED");
  }

  const payload = await verifySessionToken(token, secret);

  if (roles && roles.length > 0 && !roles.includes(payload.role)) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }

  return payload;
}
