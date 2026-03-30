import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { getWorkerEnv } from "@/lib/env";
import { requireAuth } from "@/lib/auth/guard";

function getPresenceStub(env: ReturnType<typeof getWorkerEnv>) {
  const id = env.PRESENCE_HUB.idFromName("global-presence");
  return env.PRESENCE_HUB.get(id);
}

export async function GET(request: NextRequest) {
  try {
    const env = getWorkerEnv();
    const session = await requireAuth(request, env.AUTH_SECRET, ["owner", "designer"]);

    if (request.headers.get("upgrade") === "websocket") {
      const url = new URL(request.url);
      const wsUrl = `https://presence/ws?role=${encodeURIComponent(session.role)}&userId=${encodeURIComponent(
        session.sub
      )}`;
      const stub = getPresenceStub(env);
      return stub.fetch(
        new Request(wsUrl, {
          method: "GET",
          headers: request.headers
        })
      );
    }

    const stub = getPresenceStub(env);
    const response = await stub.fetch("https://presence/users");
    return new Response(response.body, {
      status: response.status,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const env = getWorkerEnv();
    const session = await requireAuth(request, env.AUTH_SECRET, ["owner", "designer"]);
    const body = (await request.json()) as { status?: "online" | "offline" };

    if (!body.status) {
      throw new AppError("status is required", 422, "VALIDATION_ERROR");
    }

    const stub = getPresenceStub(env);
    const response = await stub.fetch(
      new Request("https://presence/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.sub,
          role: session.role,
          status: body.status
        })
      })
    );

    return new Response(response.body, {
      status: response.status,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return fail(error);
  }
}
