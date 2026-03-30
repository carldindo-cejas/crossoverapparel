"use client";

import { useEffect, useMemo, useState } from "react";
import { createPresenceClient } from "@/lib/realtime/presence-client";

type PresenceUser = {
  userId: string;
  role: "admin" | "designer" | "staff";
  connections: number;
  lastSeenAt: string;
};

export function usePresence() {
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [connected, setConnected] = useState(false);

  const client = useMemo(
    () =>
      createPresenceClient({
        onOpen: () => setConnected(true),
        onClose: () => setConnected(false),
        onEvent: (event) => {
          if (event.type === "presence.snapshot" || event.type === "presence.updated") {
            const nextUsers = (event.payload.users || []) as PresenceUser[];
            setUsers(nextUsers);
          }
        }
      }),
    []
  );

  useEffect(() => {
    client.connect();

    return () => {
      client.disconnect();
    };
  }, [client]);

  return {
    connected,
    users
  };
}
