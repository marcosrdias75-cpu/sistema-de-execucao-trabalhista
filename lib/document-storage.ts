import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

function storageRoot() {
  return resolve(process.env.STORAGE_ROOT?.trim() || "/data/documents");
}

function resolveStorageKey(key: string) {
  const root = storageRoot();
  const normalized = resolve(root, key.replace(/^[/\\]+/, ""));
  const separator = process.platform === "win32" ? "\\" : "/";

  if (normalized !== root && !normalized.startsWith(`${root}${separator}`)) {
    throw new Error("Caminho de armazenamento invalido.");
  }

  return normalized;
}

export async function storeDocumentBytes(input: {
  key: string;
  bytes: ArrayBuffer;
  contentType: string;
}) {
  const path = resolveStorageKey(input.key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, Buffer.from(input.bytes), { mode: 0o600 });
  return path;
}

export async function getDocumentBytes(key: string) {
  return readFile(resolveStorageKey(key));
}
