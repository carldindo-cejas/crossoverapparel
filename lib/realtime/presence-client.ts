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

  function connect() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      return socket;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/api/presence`;
    socket = new WebSocket(url);

    socket.onopen = () => {
      handlers.onOpen?.();
      socket?.send("ping");
    };

    socket.onclose = () => {
      handlers.onClose?.();
    };

    socket.onerror = (event) => {
      handlers.onError?.(event);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data)) as PresenceEvent;
        handlers.onEvent?.(data);
      } catch {
        // Ignore malformed payloads.
      }
    };

    return socket;
  }

  function disconnect() {
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
