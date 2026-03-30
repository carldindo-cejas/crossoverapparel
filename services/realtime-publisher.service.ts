import type { WorkerEnv } from "@/db/client";

type RealtimeEvent = {
  type: string;
  userId?: string;
  payload: Record<string, unknown>;
};

export async function publishRealtimeEvent(env: WorkerEnv, event: RealtimeEvent): Promise<void> {
  if (!env.REALTIME_API_URL) {
    return;
  }

  try {
    await fetch(`${env.REALTIME_API_URL.replace(/\/$/, "")}/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.REALTIME_API_TOKEN ? { Authorization: `Bearer ${env.REALTIME_API_TOKEN}` } : {})
      },
      body: JSON.stringify(event)
    });
  } catch {
    // Keep business logic non-blocking if realtime network fails.
  }
}
