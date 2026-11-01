import pg from 'pg';
import { attachDatabasePool } from '@vercel/functions';

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
export function postgresDatabase(connectionString: string, options: Pick<pg.PoolConfig, 'ssl'> = {}): Database {
  const pool = new pg.Pool({
    ...options, connectionString, connectionTimeoutMillis: 10_000,
    max: 4, idleTimeoutMillis: 5_000, maxLifetimeSeconds: 60,
  });
  pool.on('error', error => console.error('Idle database connection error:', error));
  if (process.env.VERCEL === '1') attachDatabasePool(pool);
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
