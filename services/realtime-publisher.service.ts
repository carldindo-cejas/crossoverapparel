import type { WorkerEnv } from "@/db/client";

type RealtimeEvent = {
  type: string;
  userId?: string;
  payload: Record<string, unknown>;
};

export async function publishRealtimeEvent(env: WorkerEnv, event: RealtimeEvent): Promise<void> {
  try {
    // Broadcast through the PRESENCE_HUB Durable Object so all connected WebSocket clients receive it
    const id = env.PRESENCE_HUB.idFromName("global-presence");
    const stub = env.PRESENCE_HUB.get(id);
    await stub.fetch("https://presence/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event)
    });
  } catch {
    // Keep business logic non-blocking if realtime broadcast fails.
  }
}
