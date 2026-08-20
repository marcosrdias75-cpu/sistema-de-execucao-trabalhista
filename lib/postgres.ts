import { Pool, types, type PoolClient, type QueryResultRow } from "pg";

types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(1700, (value) => Number(value));
types.setTypeParser(1082, (value) => value);
types.setTypeParser(1184, (value) => value);

declare global {
  var __sigrjPool: Pool | undefined;
}

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();

  if (!value) {
    throw new Error("DATABASE_URL nao configurada.");
  }

  return value;
}

export function getPool() {
  globalThis.__sigrjPool ??= new Pool({
    connectionString: databaseUrl(),
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  return globalThis.__sigrjPool;
}

function postgresSql(sql: string) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

export class PreparedStatement {
  readonly sql: string;
  private values: unknown[] = [];

  constructor(sql: string) {
    this.sql = postgresSql(sql);
  }

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async first<T extends QueryResultRow>() {
    const result = await getPool().query<T>(this.sql, this.values);
    return result.rows[0] ?? null;
  }

  async all<T extends QueryResultRow>() {
    const result = await getPool().query<T>(this.sql, this.values);
    return { results: result.rows };
  }

  async run(client?: PoolClient) {
    const executor = client ?? getPool();
    const result = await executor.query(this.sql, this.values);
    return { changes: result.rowCount ?? 0, success: true };
  }
}

export const postgresDatabase = {
  prepare(sql: string) {
    return new PreparedStatement(sql);
  },

  async batch(statements: PreparedStatement[]) {
    const client = await getPool().connect();

    try {
      await client.query("BEGIN");
      const results = [];
      for (const statement of statements) results.push(await statement.run(client));
      await client.query("COMMIT");
      return results;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};
