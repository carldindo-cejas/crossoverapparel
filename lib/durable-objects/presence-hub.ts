import { DurableObject } from "cloudflare:workers";

type PresenceRole = "owner" | "designer";

type PresenceUser = {
  userId: string;
  role: PresenceRole;
  connections: number;
  lastSeenAt: string;
};

type PresenceMessage = {
  type: string;
  payload: Record<string, unknown>;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export class PresenceHub extends DurableObject {
  private state: DurableObjectState;
  private sessions = new Map<WebSocket, { userId: string; role: PresenceRole }>();
  private onlineUsers = new Map<string, PresenceUser>();

  constructor(state: DurableObjectState, env: any) {
    super(state, env);
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get("Upgrade") === "websocket" || url.pathname.endsWith("/ws")) {
      return this.handleWebSocket(request);
    }

    if (request.method === "GET" && url.pathname.endsWith("/users")) {
      return this.listUsers();
    }

    if (request.method === "POST" && url.pathname.endsWith("/presence")) {
      return this.setPresence(request);
    }

    if (request.method === "POST" && url.pathname.endsWith("/broadcast")) {
      return this.broadcastMessage(request);
    }

    return json({ success: false, error: { message: "Not found" } }, 404);
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return json({ success: false, error: { message: "Expected websocket upgrade" } }, 426);
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get("userId")?.trim() || "";
    const roleRaw = url.searchParams.get("role")?.trim() || "";

    if (!userId) {
      return json({ success: false, error: { message: "userId is required" } }, 400);
    }

    if (!this.isPresenceRole(roleRaw)) {
      return json({ success: false, error: { message: "role must be owner or designer" } }, 400);
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.state.acceptWebSocket(server);
    server.serializeAttachment({ userId, role: roleRaw });
    this.sessions.set(server, { userId, role: roleRaw });

    const existing = this.onlineUsers.get(userId);
    const now = new Date().toISOString();

    this.onlineUsers.set(userId, {
      userId,
      role: roleRaw,
      connections: (existing?.connections ?? 0) + 1,
      lastSeenAt: now
    });

    this.send(server, {
      type: "presence.snapshot",
      payload: {
        users: Array.from(this.onlineUsers.values())
      }
    });

    this.broadcast({
      type: "presence.updated",
      payload: {
        userId,
        role: roleRaw,
        status: "online",
        users: Array.from(this.onlineUsers.values())
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const meta = (ws.deserializeAttachment() ?? this.sessions.get(ws)) as { userId: string; role: PresenceRole } | undefined;
    this.sessions.delete(ws);

    const session = meta;
    if (!session) {
      return;
    }

    const previous = this.onlineUsers.get(session.userId);
    if (!previous) {
      return;
    }

    if (previous.connections <= 1) {
      this.onlineUsers.delete(session.userId);
      this.broadcast({
        type: "presence.updated",
        payload: {
          userId: session.userId,
          role: session.role,
          status: "offline",
          users: Array.from(this.onlineUsers.values())
        }
      });
      return;
    }

    this.onlineUsers.set(session.userId, {
      ...previous,
      connections: previous.connections - 1,
      lastSeenAt: new Date().toISOString()
    });

    this.broadcast({
      type: "presence.updated",
      payload: {
        userId: session.userId,
        role: session.role,
        status: "online",
        users: Array.from(this.onlineUsers.values())
      }
    });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") {
      return;
    }

    if (message === "ping") {
      this.send(ws, { type: "pong", payload: {} });
      return;
    }

    try {
      const data = JSON.parse(message) as PresenceMessage;
      if (data.type === "presence.ping") {
        this.send(ws, {
          type: "presence.snapshot",
          payload: {
            users: Array.from(this.onlineUsers.values())
          }
        });
      }
    } catch {
      // Ignore malformed messages.
    }
  }

  private listUsers() {
    return json({
      success: true,
      data: {
        users: Array.from(this.onlineUsers.values())
      }
    });
  }

  private async setPresence(request: Request) {
    const body = (await request.json()) as {
      userId?: string;
      role?: string;
      status?: "online" | "offline";
    };

    const userId = body.userId?.trim() || "";
    const role = body.role?.trim() || "";
    const status = body.status;

    if (!userId || !this.isPresenceRole(role)) {
      return json({ success: false, error: { message: "userId and valid role are required" } }, 400);
    }

    if (status === "offline") {
      this.onlineUsers.delete(userId);
    } else {
      const previous = this.onlineUsers.get(userId);
      this.onlineUsers.set(userId, {
        userId,
        role,
        connections: previous?.connections ?? 1,
        lastSeenAt: new Date().toISOString()
      });
    }

    this.broadcast({
      type: "presence.updated",
      payload: {
        userId,
        role,
        status: status || "online",
        users: Array.from(this.onlineUsers.values())
      }
    });

    return this.listUsers();
  }

  private async broadcastMessage(request: Request) {
    const body = (await request.json()) as PresenceMessage & { userId?: string };
    if (!body.type) {
      return json({ success: false, error: { message: "type is required" } }, 400);
    }

    // Route events to the right audience
    if (body.type === "order.created" || body.type === "dashboard.updated") {
      this.broadcastToRole(body, "owner");
    } else if (body.type === "assignment.updated" && body.userId) {
      this.broadcastToUser(body, body.userId);
    } else {
      this.broadcast(body);
    }

    return json({ success: true });
  }

  private send(ws: WebSocket, message: PresenceMessage) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(message));
    }
  }

  private broadcast(message: PresenceMessage) {
    const encoded = JSON.stringify(message);
    for (const ws of this.state.getWebSockets()) {
      if (ws.readyState === 1) {
        ws.send(encoded);
      }
    }
  }

  private broadcastToRole(message: PresenceMessage, role: PresenceRole) {
    const encoded = JSON.stringify(message);
    for (const ws of this.state.getWebSockets()) {
      if (ws.readyState !== 1) continue;
      const meta = ws.deserializeAttachment() as { role?: string } | null;
      if (meta?.role === role) {
        ws.send(encoded);
      }
    }
  }

  private broadcastToUser(message: PresenceMessage, targetUserId: string) {
    const encoded = JSON.stringify(message);
    for (const ws of this.state.getWebSockets()) {
      if (ws.readyState !== 1) continue;
      const meta = ws.deserializeAttachment() as { userId?: string } | null;
      if (meta?.userId === targetUserId) {
        ws.send(encoded);
      }
    }
  }

  private isPresenceRole(value: string): value is PresenceRole {
    return value === "owner" || value === "designer";
  }
}
