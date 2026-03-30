"use client";

import { useEffect, useRef } from "react";

type UseRealtimeOptions = {
  role: "owner" | "designer";
  userId?: string;
  onEvent: (event: { type: string; userId?: string; payload: Record<string, unknown> }) => void;
};

export function useRealtime({ role, userId, onEvent }: UseRealtimeOptions) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let socket: WebSocket | null = null;
    let cancelled = false;

    async function connect() {
      const response = await fetch("/api/realtime/config", { cache: "no-store" });
      const payload = (await response.json()) as {
        success: boolean;
        data?: { wsUrl?: string };
      };

      const wsBase = payload.success ? payload.data?.wsUrl || "" : "";

      if (!wsBase || cancelled) return;

      const url = new URL(wsBase);
      url.searchParams.set("role", role);
      if (userId) url.searchParams.set("userId", userId);

      socket = new WebSocket(url.toString());

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data)) as {
            type: string;
            userId?: string;
            payload: Record<string, unknown>;
          };
          onEventRef.current(data);
        } catch {
          // ignore malformed events
        }
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [role, userId]);
}
