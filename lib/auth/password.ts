import { AppError } from "@/lib/errors";

const encoder = new TextEncoder();
const ITERATIONS = 100000;

/* ── Hex encoding (D1-safe: only [0-9a-f]) ── */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/* ── Legacy base64 decoding (for passwords hashed before hex migration) ── */
function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
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
  // Use hex encoding with "pbkdf2-v2" tag for D1 compatibility
  const hash = `pbkdf2-v2$${ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(digest)}`;
  return hash;
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

  let salt: Uint8Array;
  let expected: Uint8Array;
  let iterations: number;

  if (parts.length === 4 && parts[0] === "pbkdf2-v2") {
    // New hex-encoded format: pbkdf2-v2$iterations$hexSalt$hexDigest
    iterations = Number(parts[1]);
    salt = hexToBytes(parts[2]);
    expected = hexToBytes(parts[3]);
  } else if (parts.length === 4 && parts[0] === "pbkdf2") {
    // Legacy base64-encoded format: pbkdf2$iterations$b64Salt$b64Digest
    iterations = Number(parts[1]);
    salt = base64ToBytes(parts[2]);
    expected = base64ToBytes(parts[3]);
  } else {
    return false;
  }

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
