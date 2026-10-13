import { createApp } from './app.ts';
import { postgresDatabase } from './db.ts';
import { sandboxDatabase } from './sandbox-db.ts';
import { STAFF } from './seed-ids.ts';

// Optional .env with DATABASE_URL and PORT; see .env.example.
try {
  process.loadEnvFile();
} catch {
  // No .env file: use the environment as is.
}

const port = Number(process.env.PORT ?? 3001);
const databaseUrl = process.env.DATABASE_URL;
const db = databaseUrl ? postgresDatabase(databaseUrl) : await sandboxDatabase();

createApp(db).listen(port, () => {
  console.log(`Merto backend listening on http://localhost:${port}`);
  if (databaseUrl) return;
  console.log('No DATABASE_URL: using an in-memory sandbox loaded from supabase/migrations and seed.');
  console.log(`Try: curl -X POST -H "X-Staff-Id: ${STAFF.karen}" http://localhost:${port}/api/evaluations/run`);
});
