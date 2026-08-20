import pg from "pg";

const { Pool } = pg;
const required = ["DATABASE_URL", "ADMIN_EMAIL", "ADMIN_NAME", "ADMIN_PASSWORD_HASH"];
for (const key of required) {
  if (!process.env[key]?.trim()) throw new Error(`${key} nao configurada.`);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const now = new Date().toISOString();

try {
  await pool.query(
    `insert into users (
       email, name, role, password_hash, must_change_password, created_at, updated_at,
       password_changed_at, temporary_credential_created_at
     ) values ($1, $2, 'leader', $3, 1, $4, $4, null, $4)
     on conflict (email) do update set
       name = excluded.name,
       role = excluded.role,
       password_hash = excluded.password_hash,
       must_change_password = 1,
       updated_at = excluded.updated_at,
       temporary_credential_created_at = excluded.temporary_credential_created_at`,
    [
      process.env.ADMIN_EMAIL.trim().toLowerCase(),
      process.env.ADMIN_NAME.trim(),
      process.env.ADMIN_PASSWORD_HASH.trim(),
      now,
    ],
  );
  console.log("Administrador inicial configurado com troca obrigatoria de senha.");
} finally {
  await pool.end();
}
