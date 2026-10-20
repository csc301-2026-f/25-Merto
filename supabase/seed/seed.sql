-- Fictional data for one dealership. Runs after migrations on supabase db reset.
-- Fixed IDs make this seed repeatable; relative dates keep the demo relevant.
begin;

insert into public.staff_users (id, name, role, email) values
  ('10000000-0000-0000-0000-000000000001', 'Karen Holt', 'gm', 'karen@example.com'),
  ('10000000-0000-0000-0000-000000000002', 'Dana Kowalski', 'rep', 'dana@example.com'),
  ('10000000-0000-0000-0000-000000000003', 'Arjun Mehta', 'rep', 'arjun@example.com')
on conflict (id) do nothing;

insert into public.buyers (id, name, email, preferred_channel, opted_out, created_at) values
  ('20000000-0000-0000-0000-000000000001', 'Jordan Lee', 'jordan@example.com', 'email', false, now() - interval '3 days'),
  ('20000000-0000-0000-0000-000000000002', 'Hannah Clarke', 'hannah@example.com', 'email', false, now() - interval '2 days'),
  ('20000000-0000-0000-0000-000000000003', 'Nina Shah', 'nina@example.com', 'email', false, now() - interval '1 day'),
  ('20000000-0000-0000-0000-000000000004', 'Rob Lindqvist', 'rob@example.com', 'email', true, now() - interval '4 days')
on conflict (id) do nothing;

insert into public.deals (id, buyer_id, owner_id, vehicle_interest, source, stage, lost_reason, created_at) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Used Toyota RAV4', 'website', 'appointment_set', null, now() - interval '3 days'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Honda CR-V lease', 'email', 'working', null, now() - interval '2 days'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', null, 'Used Hyundai Tucson', 'email', 'new', null, now() - interval '1 day'),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003', 'Used Mazda CX-5', 'listing_portal', 'lost', 'opted out', now() - interval '4 days')
on conflict (id) do nothing;

insert into public.timeline_events (id, deal_id, actor_type, actor_id, channel, direction, body, created_at) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'buyer', null, 'web', 'inbound', 'Interested in the RAV4. I have a Civic to trade in.', now() - interval '3 days'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'ai', null, 'email', 'outbound', '[Simulated] Your visit request is recorded. A person will confirm the time.', now() - interval '3 days' + interval '1 minute'),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'gm', '10000000-0000-0000-0000-000000000001', 'note', 'internal', 'Assigned Jordan to Dana.', now() - interval '2 days'),
  ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', 'rep', '10000000-0000-0000-0000-000000000002', 'email', 'outbound', '[Simulated] Your appointment tomorrow is confirmed.', now() - interval '1 hour'),
  ('40000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000002', 'buyer', null, 'email', 'inbound', 'Interested in leasing a CR-V. Can Arjun help me?', now() - interval '2 days'),
  ('40000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000002', 'rep', '10000000-0000-0000-0000-000000000003', 'note', 'internal', 'Discussed lease options. Promised to send a quote.', now() - interval '1 day'),
  ('40000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000002', 'gm', '10000000-0000-0000-0000-000000000001', 'note', 'internal', 'Transferred Hannah from Arjun to Dana because Arjun is away. Quote still pending.', now() - interval '2 hours'),
  ('40000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000003', 'buyer', null, 'email', 'inbound', 'Can I visit to see the Tucson?', now() - interval '1 day'),
  ('40000000-0000-0000-0000-000000000009', '30000000-0000-0000-0000-000000000004', 'buyer', null, 'email', 'inbound', 'Please stop contacting me.', now() - interval '2 days'),
  ('40000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000004', 'system', null, 'note', 'internal', 'Buyer opted out. Follow-ups blocked; deal closed as lost.', now() - interval '2 days' + interval '1 minute')
on conflict (id) do nothing;

-- Structured labels let queries identify actions without interpreting message text.
update public.timeline_events set event_type = 'assignment'
where id = '40000000-0000-0000-0000-000000000003';
update public.timeline_events set event_type = 'transfer'
where id = '40000000-0000-0000-0000-000000000007';
update public.timeline_events set event_type = 'opt_out'
where id = '40000000-0000-0000-0000-000000000009';

insert into public.appointments (id, deal_id, scheduled_for, status, confirmed_by, confirmed_at) values
  ('50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', now() + interval '1 day', 'confirmed', '10000000-0000-0000-0000-000000000002', now() - interval '1 hour'),
  ('50000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', now() + interval '2 days', 'requested', null, null)
on conflict (id) do nothing;

insert into public.open_items (id, deal_id, owner_id, type, description, status, due_at, created_at, resolved_at) values
  ('60000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'promise', 'Send a trade-in estimate for the Civic.', 'open', now() + interval '2 hours', now() - interval '1 day', null),
  ('60000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'promise', 'Send the CR-V lease quote promised by Arjun.', 'open', now() - interval '1 hour', now() - interval '1 day', null),
  ('60000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', null, 'callback', 'Assign a rep and confirm the requested visit.', 'open', now() - interval '2 hours', now() - interval '1 day', null),
  ('60000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'callback', 'Confirm Jordan visit time.', 'resolved', now(), now() - interval '2 days', now() - interval '1 hour')
on conflict (id) do nothing;

commit;
