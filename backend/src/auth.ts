import type { RequestHandler, Response } from 'express';
import type { Database } from './db.ts';
import { badRequest, forbidden, unauthorized } from './errors.ts';

export interface Staff {
  id: string;
  name: string;
  role: 'gm' | 'rep';
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireUuid(value: string, name: string): string {
  if (!uuidPattern.test(value)) throw badRequest(`${name} must be a UUID.`);
  return value;
}

// Stand-in for Supabase Auth until logins are mapped to staff_users: the caller
// names themselves in X-Staff-Id, and the server looks up their role. Every
// permission decision below uses that server-side role, never the client's word.
export function requireStaff(db: Database): RequestHandler {
  return async (req, res, next) => {
    const id = req.get('x-staff-id');
    if (!id || !uuidPattern.test(id)) throw unauthorized('Send X-Staff-Id with a staff member ID.');
    const [staff] = await db.query<Staff>(
      'select id, name, role from public.staff_users where id = $1', [id]);
    if (!staff) throw unauthorized('Unknown staff member.');
    res.locals.staff = staff;
    next();
  };
}

export const currentStaff = (res: Response) => res.locals.staff as Staff;

export function requireGm(staff: Staff, action: string): void {
  if (staff.role !== 'gm') throw forbidden(`Only a GM can ${action}.`);
}

// A rep sees and acts on their own deals; the GM sees every deal (US10).
export function requireDealAccess(staff: Staff, ownerId: string | null): void {
  if (staff.role !== 'gm' && ownerId !== staff.id) {
    throw forbidden('Reps can only access their own deals.');
  }
}
