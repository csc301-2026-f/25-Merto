import pg from 'pg';

export interface Queryable {
  query<Row>(sql: string, params?: unknown[]): Promise<Row[]>;
}

// Services depend only on this, so tests and the sandbox can use PGlite while
// deployments use a real PostgreSQL/Supabase connection.
export interface Database extends Queryable {
  transaction<T>(work: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

// Server-side connection only: the database grants no access to browser roles.
export function postgresDatabase(connectionString: string): Database {
  const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 10_000 });
  return {
    async query<Row>(sql: string, params: unknown[] = []) {
      return (await pool.query(sql, params)).rows as Row[];
    },
    async transaction<T>(work: (tx: Queryable) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const result = await work({
          async query<Row>(sql: string, params: unknown[] = []) {
            return (await client.query(sql, params)).rows as Row[];
          },
        });
        await client.query('commit');
        return result;
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}
