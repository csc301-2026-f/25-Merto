import express from 'express';
import { readFileSync } from 'node:fs';
import { createApp } from './src/app.ts';
import { postgresDatabase } from './src/db.ts';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL must be configured for deployment.');

const connection = new URL(databaseUrl);
// Transaction pooling lets serverless instances share database connections.
if (connection.hostname.endsWith('.pooler.supabase.com') && connection.port === '5432') {
  connection.port = '6543';
}
let ssl;
if (connection.searchParams.get('sslrootcert') === 'certs/supabase-ca.crt') {
  ssl = { ca: readFileSync(new URL('./certs/supabase-ca.crt', import.meta.url), 'utf8'), rejectUnauthorized: true };
  for (const key of ['sslrootcert', 'sslmode', 'sslcert', 'sslkey']) connection.searchParams.delete(key);
}

const db = postgresDatabase(connection.toString(), { ssl });
const app = express();
app.use(createApp(db, { devLoginPassword: process.env.DEV_LOGIN_PASSWORD }));

export default app;
