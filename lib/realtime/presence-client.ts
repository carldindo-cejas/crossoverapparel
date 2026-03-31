export type PresenceEvent = {
  type: string;
  payload: Record<string, unknown>;
};

export type PresenceClientHandlers = {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (event: Event) => void;
  onEvent?: (event: PresenceEvent) => void;
};

export function createPresenceClient(handlers: PresenceClientHandlers = {}) {
  let socket: WebSocket | null = null;
  let cancelled = false;
  let retryCount = 0;
  let retryTimeout: ReturnType<typeof setTimeout>;
  let heartbeatInterval: ReturnType<typeof setInterval>;

  function connect() {
    if (cancelled) return null;
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      return socket;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/api/presence`;
    socket = new WebSocket(url);

    socket.onopen = () => {
      retryCount = 0;
      handlers.onOpen?.();
      socket?.send("ping");
      heartbeatInterval = setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send("ping");
        }
      }, 30000);
    };

    socket.onclose = () => {
      clearInterval(heartbeatInterval);
      handlers.onClose?.();
      if (!cancelled) {
        const delay = Math.min(1000 * 2 ** retryCount, 30000);
        retryCount++;
        retryTimeout = setTimeout(connect, delay);
      }
    };

    socket.onerror = (event) => {
      handlers.onError?.(event);
      socket?.close();
    };

    socket.onmessage = (event) => {
      try {
        const text = String(event.data);
        if (text === "pong") return;
        const data = JSON.parse(text) as PresenceEvent;
        if (data.type === "pong") return;
        handlers.onEvent?.(data);
      } catch {
        // Ignore malformed payloads.
      }
    };

    return socket;
  }

  function disconnect() {
    cancelled = true;
    clearTimeout(retryTimeout);
    clearInterval(heartbeatInterval);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.close();
    }
    socket = null;
  }

  return {
    connect,
    disconnect,
    get socket() {
      return socket;
    }
  };
}
