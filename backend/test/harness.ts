import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach } from 'node:test';
import { createApp, type AppOptions } from '../src/app.ts';
import type { Database } from '../src/db.ts';
import { sandboxDatabase } from '../src/sandbox-db.ts';

// Ports the Fetch standard blocks above 1023.
const FETCH_BLOCKED_PORTS = new Set([1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061,
  6000, 6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697, 10080]);

export interface Api {
  db: Database;
  // `as` is the X-Staff-Id to send, or null to send none.
  call(as: string | null, method: string, path: string, body?: object): Promise<{ status: number; body: any }>;
}

// Each test in the calling suite gets a fresh in-memory database built from
// supabase/migrations and supabase/seed, and talks to the API over real HTTP.
export function useApi(options: AppOptions = {}): Api {
  let server: Server;
  let baseUrl: string;
  const api: Api = {
    db: undefined as unknown as Database,
    async call(as, method, path, body) {
      const headers: Record<string, string> = {};
      if (as) headers['x-staff-id'] = as;
      if (body) headers['content-type'] = 'application/json';
      const response = await fetch(baseUrl + path, { method, headers, body: body && JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    },
  };

  beforeEach(async () => {
    api.db = await sandboxDatabase();
    // fetch refuses some ports (e.g. 6000, 10080); retry when listen(0) picks one.
    for (;;) {
      server = createApp(api.db, options).listen(0);
      await new Promise((resolve) => server.once('listening', resolve));
      if (!FETCH_BLOCKED_PORTS.has((server.address() as AddressInfo).port)) break;
      server.close();
    }
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    server.closeAllConnections();
    server.close();
    await api.db.close();
  });

  return api;
}
