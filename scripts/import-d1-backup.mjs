import { readFile } from "node:fs/promises";
import pg from "pg";

const { Pool } = pg;
const backupPath = process.env.D1_BACKUP_PATH;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL nao configurada.");
if (!backupPath) throw new Error("D1_BACKUP_PATH nao configurada.");

const backup = JSON.parse(await readFile(backupPath, "utf8"));
const tables = backup.tables ?? {};
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

async function upsert(table, row, conflictColumn) {
  const keys = Object.keys(row);
  const values = keys.map((key) => row[key]);
  const columns = keys.map((key) => `"${key}"`).join(", ");
  const placeholders = keys.map((_, index) => `$${index + 1}`).join(", ");
  const updates = keys
    .filter((key) => key !== conflictColumn)
    .map((key) => `"${key}" = excluded."${key}"`)
    .join(", ");
  await client.query(
    `insert into "${table}" (${columns}) values (${placeholders})
     on conflict ("${conflictColumn}") do update set ${updates}`,
    values,
  );
}

try {
  await client.query("begin");
  for (const row of tables.users?.rows ?? []) {
    await upsert("users", { ...row, must_change_password: 1 }, "email");
  }
  for (const row of tables.pilot_edits?.rows ?? []) {
    await upsert("pilot_edits", row, "process_number");
  }
  for (const row of tables.ai_analysis_runs?.rows ?? []) {
    await upsert("ai_analysis_runs", row, "id");
  }
  for (const row of tables.app_settings?.rows ?? []) {
    if (row.key === "openclaw_webhook_token") continue;
    await upsert("app_settings", row, "key");
  }
  await client.query("commit");
  console.log("Backup D1 importado; token OpenClaw antigo foi deliberadamente ignorado.");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
