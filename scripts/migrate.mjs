import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL nao configurada.");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const directory = join(process.cwd(), "db", "migrations");

try {
  await pool.query(`create table if not exists schema_migrations (
    filename text primary key,
    applied_at timestamptz not null default now()
  )`);
  const applied = new Set(
    (await pool.query("select filename from schema_migrations")).rows.map((row) => row.filename),
  );
  const files = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();

  for (const filename of files) {
    if (applied.has(filename)) {
      console.log(`ja aplicada: ${filename}`);
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(await readFile(join(directory, filename), "utf8"));
      await client.query("insert into schema_migrations (filename) values ($1)", [filename]);
      await client.query("commit");
      console.log(`aplicada: ${filename}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}
