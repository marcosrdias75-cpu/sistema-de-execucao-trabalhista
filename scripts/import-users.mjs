import { readFile, writeFile } from "node:fs/promises";
import { randomBytes, webcrypto } from "node:crypto";
import pg from "pg";

const { Pool } = pg;
const hashIterations = 100_000;
const encoder = new TextEncoder();
const allowedRoles = new Set(["leader", "administrador", "advogado", "analista", "financeiro", "operador", "auditor"]);

if (!process.env.DATABASE_URL?.trim()) {
  throw new Error("DATABASE_URL nao configurada.");
}

const inputPath = process.argv[2];

if (!inputPath) {
  throw new Error("Uso: node scripts/import-users.mjs usuarios.csv");
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value) {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

async function hashCredential(credential, salt) {
  const actualSalt = salt ?? bytesToHex(webcrypto.getRandomValues(new Uint8Array(16)));
  const keyMaterial = await webcrypto.subtle.importKey(
    "raw",
    encoder.encode(credential),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await webcrypto.subtle.deriveBits(
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

function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      row.push(field.trim());
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      field = "";
      row = [];
      continue;
    }

    field += char;
  }

  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function toCsvValue(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function makeTemporaryPassword() {
  return randomBytes(12).toString("base64url");
}

function readRecords(rows) {
  const [header, ...data] = rows;
  const indexes = new Map(header.map((name, index) => [name.trim().toLowerCase(), index]));

  for (const required of ["email", "name"]) {
    if (!indexes.has(required)) throw new Error(`Coluna obrigatoria ausente: ${required}`);
  }

  return data.map((row, index) => {
    const email = row[indexes.get("email")]?.trim().toLowerCase() ?? "";
    const name = row[indexes.get("name")]?.trim() ?? "";
    const role = row[indexes.get("role")]?.trim().toLowerCase() || "advogado";
    const password = row[indexes.get("password")]?.trim() || makeTemporaryPassword();

    if (!email || !email.includes("@")) throw new Error(`E-mail invalido na linha ${index + 2}.`);
    if (!name) throw new Error(`Nome ausente na linha ${index + 2}.`);
    if (!allowedRoles.has(role)) throw new Error(`Perfil invalido na linha ${index + 2}: ${role}`);

    return { email, name, password, role };
  });
}

const rows = parseCsv(await readFile(inputPath, "utf8"));
const records = readRecords(rows);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const now = new Date().toISOString();
const imported = [];

try {
  for (const record of records) {
    const hash = await hashCredential(record.password);
    await pool.query(
      `insert into users (
        email, name, role, password_hash, must_change_password, created_at, updated_at,
        password_changed_at, temporary_credential_created_at
      ) values ($1, $2, $3, $4, 1, $5, $5, null, $5)
      on conflict (email) do update set
        name = excluded.name,
        role = excluded.role,
        password_hash = excluded.password_hash,
        must_change_password = 1,
        updated_at = excluded.updated_at,
        temporary_credential_created_at = excluded.temporary_credential_created_at`,
      [record.email, record.name, record.role, hash, now],
    );
    imported.push(record);
  }
} finally {
  await pool.end();
}

const outputRows = [
  ["email", "name", "role", "temporary_password"],
  ...imported.map((record) => [record.email, record.name, record.role, record.password]),
];
const output = `${outputRows.map((row) => row.map(toCsvValue).join(",")).join("\n")}\n`;
const outputPath = process.env.OUTPUT_PATH?.trim();

if (outputPath) {
  await writeFile(outputPath, output, { mode: 0o600 });
  console.log(`Usuarios importados: ${imported.length}. Credenciais temporarias em ${outputPath}`);
} else {
  process.stdout.write(output);
}
