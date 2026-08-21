import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

function storageRoot() {
  return resolve(/*turbopackIgnore: true*/ process.env.STORAGE_ROOT?.trim() || "/data/documents");
}

function resolveStorageKey(key: string) {
  const root = storageRoot();
  const direct = resolve(/*turbopackIgnore: true*/ key);
  const normalized = direct === root || direct.startsWith(`${root}${process.platform === "win32" ? "\\" : "/"}`)
    ? direct
    : resolve(/*turbopackIgnore: true*/ root, key.replace(/^[/\\]+/, ""));
  const separator = process.platform === "win32" ? "\\" : "/";

  if (normalized !== root && !normalized.startsWith(`${root}${separator}`)) {
    throw new Error("Caminho de armazenamento invalido.");
  }

  return normalized;
}

export async function storeDocumentBytes(input: {
  key: string;
  bytes: ArrayBuffer | ArrayBufferView;
  contentType: string;
}) {
  const path = resolveStorageKey(input.key);
  await mkdir(dirname(path), { recursive: true });
  const bytes = input.bytes instanceof ArrayBuffer
    ? Buffer.from(input.bytes)
    : Buffer.from(input.bytes.buffer, input.bytes.byteOffset, input.bytes.byteLength);
  await writeFile(path, bytes, { mode: 0o600 });
  return path;
}

export async function getDocumentBytes(key: string) {
  return readFile(resolveStorageKey(key));
}
