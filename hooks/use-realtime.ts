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
    let retryCount = 0;
    let retryTimeout: ReturnType<typeof setTimeout>;
    let heartbeatInterval: ReturnType<typeof setInterval>;

    async function connect() {
      if (cancelled) return;

      try {
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

        socket.onopen = () => {
          retryCount = 0;
          // Send heartbeat every 30s to keep connection alive
          heartbeatInterval = setInterval(() => {
            if (socket?.readyState === WebSocket.OPEN) {
              socket.send("ping");
            }
          }, 30000);
        };

        socket.onmessage = (event) => {
          try {
            const text = String(event.data);
            if (text === "pong") return;
            const data = JSON.parse(text) as {
              type: string;
              userId?: string;
              payload: Record<string, unknown>;
            };
            if (data.type === "pong") return;
            onEventRef.current(data);
          } catch {
            // ignore malformed events
          }
        };

        socket.onclose = () => {
          clearInterval(heartbeatInterval);
          if (!cancelled) {
            const delay = Math.min(1000 * 2 ** retryCount, 30000);
            retryCount++;
            retryTimeout = setTimeout(connect, delay);
          }
        };

        socket.onerror = () => {
          socket?.close();
        };
      } catch {
        if (!cancelled) {
          const delay = Math.min(1000 * 2 ** retryCount, 30000);
          retryCount++;
          retryTimeout = setTimeout(connect, delay);
        }
      }
    }

    connect();

    return () => {
      cancelled = true;
      clearTimeout(retryTimeout);
      clearInterval(heartbeatInterval);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [role, userId]);
}
