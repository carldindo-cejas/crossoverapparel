import { AppError } from "@/lib/errors";

export type SessionPayload = {
  sub: string;
  email: string;
  role: "owner" | "designer" | "customer";
  exp: number;
};

const encoder = new TextEncoder();

function base64UrlEncode(value: Uint8Array | string) {
  const raw =
    typeof value === "string"
      ? Buffer.from(value, "utf8")
      : Buffer.from(value.buffer, value.byteOffset, value.byteLength);

  return raw
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

async function sign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return base64UrlEncode(new Uint8Array(signature));
}

export async function createSessionToken(
  payload: Omit<SessionPayload, "exp">,
  secret: string,
  ttlSeconds = 60 * 60 * 8
): Promise<string> {
  if (!secret) {
    throw new AppError("AUTH_SECRET is missing", 500, "AUTH_SECRET_MISSING");
  }

  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = base64UrlEncode(JSON.stringify({ ...payload, exp }));
  const content = `${header}.${body}`;
  const signature = await sign(content, secret);

  return `${content}.${signature}`;
}

export async function verifySessionToken(token: string, secret: string): Promise<SessionPayload> {
  if (!secret) {
    throw new AppError("AUTH_SECRET is missing", 500, "AUTH_SECRET_MISSING");
  }

  const [header, payload, signature] = token.split(".");

  if (!header || !payload || !signature) {
    throw new AppError("Invalid token", 401, "INVALID_TOKEN");
  }

  const content = `${header}.${payload}`;
  const expectedSignature = await sign(content, secret);

  if (expectedSignature !== signature) {
    throw new AppError("Invalid token signature", 401, "INVALID_TOKEN");
  }

  const decoded = JSON.parse(base64UrlDecode(payload).toString("utf8")) as SessionPayload;

  if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) {
    throw new AppError("Token expired", 401, "TOKEN_EXPIRED");
  }

  return decoded;
}
