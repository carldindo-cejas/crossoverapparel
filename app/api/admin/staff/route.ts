import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { requireAuth } from "@/lib/auth/guard";
import { createDesigner, listStaffWithStatus } from "@/services/staff-admin.service";

export async function GET(request: NextRequest) {
  try {
    const env = getWorkerEnv();
    await requireAuth(request, env.AUTH_SECRET, ["owner"]);
    const staff = await listStaffWithStatus(env);
    return ok(staff);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const env = getWorkerEnv();
    await requireAuth(request, env.AUTH_SECRET, ["owner"]);
    const body = await request.json();
    const designer = await createDesigner(env, body);
    return ok(designer, 201);
  } catch (error) {
    return fail(error);
  }
}
