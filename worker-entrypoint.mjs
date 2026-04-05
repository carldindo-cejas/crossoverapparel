import worker from "./.open-next/worker.js";
import { PresenceHub as PresenceHubImpl } from "./lib/durable-objects/presence-hub";

// Explicitly export the PresenceHub Durable Object class for Wrangler's validator
export class PresenceHub extends PresenceHubImpl {}

// Export all other workers from OpenNext
export * from "./.open-next/worker.js";

/**
 * Verify a JWT token using HMAC-SHA256.
 * Returns the decoded payload or null if invalid/expired.
 */
async function verifyJwt(token, secret) {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return null;
        const [header, payload, signature] = parts;

        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            "raw",
            encoder.encode(secret), { name: "HMAC", hash: "SHA-256" },
            false, ["sign"]
        );

        const content = `${header}.${payload}`;
        const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(content));
        const expectedBytes = new Uint8Array(sig);

        // Decode received signature for constant-time comparison
        const receivedB64 = signature.replace(/-/g, "+").replace(/_/g, "/");
        const padded = receivedB64 + "=".repeat((4 - (receivedB64.length % 4)) % 4);
        const binaryStr = atob(padded);
        const receivedBytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
            receivedBytes[i] = binaryStr.charCodeAt(i);
        }

        // Constant-time comparison to prevent timing attacks
        if (expectedBytes.length !== receivedBytes.length) return null;
        let mismatch = 0;
        for (let i = 0; i < expectedBytes.length; i++) {
            mismatch |= expectedBytes[i] ^ receivedBytes[i];
        }
        if (mismatch !== 0) return null;

        const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
        if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) return null;

        return decoded;
    } catch {
        return null;
    }
}

/**
 * Extract the ca_token cookie value from a Cookie header string.
 */
function getTokenFromCookies(cookieHeader) {
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/(?:^|;\s*)ca_token=([^;]+)/);
    return match ? match[1] : null;
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // Handle WebSocket upgrades for /api/presence directly — OpenNext cannot
        // proxy Cloudflare WebSocket Response objects through Next.js API routes.
        if (
            url.pathname === "/api/presence" &&
            request.headers.get("Upgrade") === "websocket"
        ) {
            const token = getTokenFromCookies(request.headers.get("Cookie"));
            if (!token) {
                return new Response("Authentication required", { status: 401 });
            }

            const session = await verifyJwt(token, env.AUTH_SECRET);
            if (!session || !["owner", "designer"].includes(session.role)) {
                return new Response("Forbidden", { status: 403 });
            }

            const id = env.PRESENCE_HUB.idFromName("global-presence");
            const stub = env.PRESENCE_HUB.get(id);
            return stub.fetch(
                new Request(
                    `https://presence/ws?role=${encodeURIComponent(session.role)}&userId=${encodeURIComponent(session.sub)}`, { method: "GET", headers: request.headers }
                )
            );
        }

        // Everything else goes through OpenNext / Next.js
        return worker.fetch(request, env, ctx);
    },
};