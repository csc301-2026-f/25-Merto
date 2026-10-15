import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import type { Database, Queryable } from './db.ts';

const supabaseDir = new URL('../../supabase/', import.meta.url);

async function readSqlFiles(dir: string): Promise<string[]> {
  const names = (await readdir(new URL(`${dir}/`, supabaseDir)))
    .filter((name) => name.endsWith('.sql')).sort();
  return Promise.all(names.map((name) => readFile(new URL(`${dir}/${name}`, supabaseDir), 'utf8')));
}

// An in-memory PostgreSQL loaded like `supabase db reset`: every migration, then
// every seed file. Used by tests, the demo, and the server when no DATABASE_URL
// is set. Nothing leaves the process and nothing persists after it exits.
export async function sandboxDatabase(): Promise<Database> {
  const db = new PGlite();
  // The migrations revoke access from Supabase's two API roles, so they must exist.
  await db.exec('create role anon; create role authenticated;');
  for (const sql of await readSqlFiles('migrations')) await db.exec(sql);
  for (const sql of await readSqlFiles('seed')) await db.exec(sql);

  return {
    async query<Row>(sql: string, params: unknown[] = []) {
      return (await db.query<Row>(sql, params)).rows;
    },
    transaction<T>(work: (tx: Queryable) => Promise<T>) {
      return db.transaction((tx) => work({
        async query<Row>(sql: string, params: unknown[] = []) {
          return (await tx.query<Row>(sql, params)).rows;
        },
      }));
    },
    close: () => db.close(),
  };
}
