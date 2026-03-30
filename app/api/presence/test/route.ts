import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { requireAuth } from "@/lib/auth/guard";

export async function GET(request: NextRequest) {
  try {
    const env = getWorkerEnv();
    const session = await requireAuth(request, env.AUTH_SECRET, ["owner", "designer"]);

    const id = env.PRESENCE_HUB.idFromName("global-presence");
    const stub = env.PRESENCE_HUB.get(id);
    const response = await stub.fetch("https://presence/users");
    const payload = (await response.json()) as {
      success: boolean;
      data?: { users: unknown[] };
    };

    return ok({
      message: "Presence hub reachable",
      role: session.role,
      userId: session.sub,
      onlineUsers: payload.data?.users || []
    });
  } catch (error) {
    return fail(error);
  }
}
