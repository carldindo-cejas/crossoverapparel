import { AppError } from "@/lib/errors";

const encoder = new TextEncoder();
const ITERATIONS = 100000;

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function base64ToBytes(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64"));
}

async function pbkdf2(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const safeSalt = new Uint8Array(salt);
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: safeSalt,
      iterations: ITERATIONS
    },
    key,
    256
  );

  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 8) {
    throw new AppError("Password must be at least 8 characters", 400, "WEAK_PASSWORD");
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const digest = await pbkdf2(password, salt);
  return `pbkdf2$${ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(digest)}`;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;

  for (let i = 0; i < a.length; i += 1) {
    result |= a[i] ^ b[i];
  }

  return result === 0;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split("$");

  if (parts.length !== 4 || parts[0] !== "pbkdf2") {
    return false;
  }

  const iterations = Number(parts[1]);
  const salt = base64ToBytes(parts[2]);
  const expected = base64ToBytes(parts[3]);

  if (!Number.isFinite(iterations) || iterations <= 0) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new Uint8Array(salt),
      iterations
    },
    key,
    256
  );

  return constantTimeEqual(new Uint8Array(bits), expected);
}
