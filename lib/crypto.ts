const hashIterations = 100_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string) {
  const bytes = new Uint8Array(value.length / 2);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string) {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  const binary = atob(padded.replaceAll("-", "+").replaceAll("_", "/"));
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export function encodeJson(value: unknown) {
  return bytesToBase64Url(encoder.encode(JSON.stringify(value)));
}

export function decodeJson<T>(value: string): T | null {
  try {
    return JSON.parse(decoder.decode(base64UrlToBytes(value))) as T;
  } catch {
    return null;
  }
}

export async function signValue(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function sha256Digest(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return `sha256$${bytesToHex(new Uint8Array(digest))}`;
}

export async function hashCredential(credential: string, salt?: string) {
  const actualSalt = salt ?? bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(credential),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      hash: "SHA-256",
      iterations: hashIterations,
      name: "PBKDF2",
      salt: hexToBytes(actualSalt),
    },
    keyMaterial,
    256,
  );

  return `pbkdf2_sha256$${hashIterations}$${actualSalt}$${bytesToHex(new Uint8Array(bits))}`;
}

export async function verifyCredential(credential: string, storedHash: string) {
  const [algorithm, iterations, salt, expectedHash] = storedHash.split("$");

  if (algorithm !== "pbkdf2_sha256" || iterations !== String(hashIterations) || !salt || !expectedHash) {
    return false;
  }

  return (await hashCredential(credential, salt)) === storedHash;
}
