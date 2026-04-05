export interface RealtimeWorkerEnv {
  REALTIME_HUB: DurableObjectNamespace;
  REALTIME_API_TOKEN: string;
}

type PublishEvent = {
  type: string;
  userId?: string;
  payload: Record<string, unknown>;
};

function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export class RealtimeHub {
  state: DurableObjectState;
  sessions: Map<WebSocket, { role: string; userId?: string }>;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.sessions = new Map();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected websocket", { status: 426 });
      }

      const role = url.searchParams.get("role") || "guest";
      const userId = url.searchParams.get("userId") || undefined;
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];

      server.accept();
      this.sessions.set(server, { role, userId });

      server.addEventListener("close", () => {
        this.sessions.delete(server);
      });

      server.addEventListener("message", (event) => {
        const text = typeof event.data === "string" ? event.data : "";
        if (text === "ping") {
          server.send("pong");
        }
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === "/publish" && request.method === "POST") {
      let event: PublishEvent;
      try {
        event = (await request.json()) as PublishEvent;
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      this.broadcast(event);
      return json({ success: true });
    }

    return new Response("Not found", { status: 404 });
  }

  private broadcast(event: PublishEvent) {
    const message = JSON.stringify(event);

    for (const [socket, session] of this.sessions.entries()) {
      if (socket.readyState !== 1) continue;

      if (event.type === "assignment.updated" && event.userId && session.userId !== event.userId) {
        continue;
      }

      socket.send(message);
    }
  }
}

export default {
  async fetch(request: Request, env: RealtimeWorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({ status: "ok" });
    }

    if (url.pathname === "/publish") {
      if (!env.REALTIME_API_TOKEN) {
        return new Response("Service unavailable: REALTIME_API_TOKEN not configured", { status: 503 });
      }
      const token = request.headers.get("authorization")?.replace("Bearer ", "") || "";
      if (token !== env.REALTIME_API_TOKEN) {
        return unauthorized();
      }
    }

    const id = env.REALTIME_HUB.idFromName("global-hub");
    const stub = env.REALTIME_HUB.get(id);
    return stub.fetch(request);
  }
};
