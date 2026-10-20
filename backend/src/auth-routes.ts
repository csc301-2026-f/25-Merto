import { createHash, timingSafeEqual } from 'node:crypto';
import express from 'express';
import { currentStaff, type Staff } from './auth.ts';
import type { Database } from './db.ts';
import { badRequest, notFound, unauthorized } from './errors.ts';

const digest = (value: string) => createHash('sha256').update(value).digest();

// Development sign-in for the frontend, until Supabase Auth is mapped to
// staff_users. The username is a staff email or the part before the @, and
// every account shares one password. The token it returns is the staff ID the
// frontend then sends as X-Staff-Id; the role always comes from staff_users.
// Turned off (404) when no password is configured.
export function devLoginRoutes(db: Database, password: string | undefined) {
  const router = express.Router();

  router.post('/login', async (req, res) => {
    if (!password) throw notFound('Development sign-in is turned off.');
    const { username, password: given } = req.body ?? {};
    if (typeof username !== 'string' || !username.trim() || typeof given !== 'string' || !given) {
      throw badRequest('username and password are required.');
    }
    const name = username.trim();
    const matches = await db.query<Staff & { exact: boolean }>(`
      select id, name, role, lower(email) = lower($1) as exact from public.staff_users
      where lower(email) = lower($1) or lower(split_part(email, '@', 1)) = lower($1)
      order by exact desc, id`, [name]);
    // An exact email wins; a bare name must point to exactly one person.
    const staff = matches[0]?.exact || matches.length === 1 ? matches[0] : undefined;
    if (!staff || !timingSafeEqual(digest(given), digest(password))) {
      throw unauthorized('Username or password was incorrect.');
    }
    res.json({ token: staff.id, id: staff.id, name: staff.name, role: staff.role });
  });

  return router;
}

// Who the X-Staff-Id belongs to, with the role the server will enforce.
export function meRoutes() {
  const router = express.Router();
  router.get('/me', (_req, res) => {
    res.json(currentStaff(res));
  });
  return router;
}
