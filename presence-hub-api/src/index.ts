export interface Env {
  REALTIME_API_TOKEN: string;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    if (url.pathname === "/") {
      return jsonResponse({
        ok: true,
        service: "presence-hub",
        message: "Worker is running",
      });
    }

    if (url.pathname === "/health" && method === "GET") {
      return jsonResponse({
        status: "healthy",
      });
    }

    if (url.pathname === "/connect" && method === "POST") {
      const authHeader = request.headers.get("Authorization");

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return jsonResponse(
          { connected: false, error: "Missing or invalid Authorization header" },
          401
        );
      }

      const token = authHeader.replace("Bearer ", "").trim();

      if (token !== env.REALTIME_API_TOKEN) {
        return jsonResponse(
          { connected: false, error: "Unauthorized: invalid token" },
          401
        );
      }

      return jsonResponse({
        connected: true,
        message: "Presence Hub connected successfully",
      });
    }

    return jsonResponse({ error: "Not found" }, 404);
  },
};