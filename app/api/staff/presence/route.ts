import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { requireAuth } from "@/lib/auth/guard";
import { updateStaffPresence } from "@/services/staff.service";

export async function POST(request: NextRequest) {
  try {
    const env = getWorkerEnv();
    const session = await requireAuth(request, env.AUTH_SECRET, ["designer", "owner"]);
    const payload = await request.json();
    const result = await updateStaffPresence(env, session.sub, payload);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
