// Fixed IDs from supabase/seed/*.sql, used by the demo script and tests.
export const STAFF = {
  karen: '10000000-0000-0000-0000-000000000001', // GM
  dana: '10000000-0000-0000-0000-000000000002', // rep
  arjun: '10000000-0000-0000-0000-000000000003', // rep
} as const;

export const DEALS = {
  jordan: '30000000-0000-0000-0000-000000000001', // Dana; clean AI wording
  hannah: '30000000-0000-0000-0000-000000000002', // Dana; no AI activity
  nina: '30000000-0000-0000-0000-000000000003', // unassigned; stage new; open callback item
  rob:'30000000-0000-0000-0000-000000000004', // Arjun; opted out
  maya: '30000000-0000-0000-0000-000000000005', // Dana; AI said "you're all set"
  chris: '30000000-0000-0000-0000-000000000006', // Arjun; AI promised a sold truck
  ben: '30000000-0000-0000-0000-000000000007', // unassigned; AI quoted a payment
  marcus: '30000000-0000-0000-0000-000000000008', // Arjun; AI handed a price question to him
} as const;

export const EVENTS = {
  jordanAiReply: '40000000-0000-0000-0000-000000000002',
  jordanAssigned: '40000000-0000-0000-0000-000000000003', // text only, no deal_assignments row
  hannahTransferred: '40000000-0000-0000-0000-000000000007', // Arjun to Dana, structured
  mayaAllSet: '40000000-0000-0000-0000-000000000012',
  chrisDefinitelyHere: '40000000-0000-0000-0000-000000000015',
  benDoubleExclamation: '40000000-0000-0000-0000-000000000019',
  benPaymentQuote: '40000000-0000-0000-0000-000000000021',
} as const;
