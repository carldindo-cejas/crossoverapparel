import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { requireAuth } from "@/lib/auth/guard";
import { setStaffActiveState } from "@/services/staff-admin.service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const env = getWorkerEnv();
    await requireAuth(request, env.AUTH_SECRET, ["owner"]);
    const { id } = await params;
    const body = await request.json();
    const result = await setStaffActiveState(env, id, body);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
