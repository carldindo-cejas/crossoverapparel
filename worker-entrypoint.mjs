import worker from "./.open-next/worker.js";
import { PresenceHub as PresenceHubImpl } from "./lib/durable-objects/presence-hub";

export * from "./.open-next/worker.js";
export class PresenceHub extends PresenceHubImpl {}

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
        const sigBytes = new Uint8Array(sig);
        let expectedSig = "";
        for (let i = 0; i < sigBytes.length; i++) {
            expectedSig += String.fromCharCode(sigBytes[i]);
        }
        expectedSig = btoa(expectedSig)
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/g, "");

        if (expectedSig !== signature) return null;

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