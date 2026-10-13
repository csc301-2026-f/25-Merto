-- Fictional AI conversations for the evaluation demo. Loads after seed.sql
-- (filename order) and reuses its staff and Rob's opted-out deal.
-- Scenarios follow the Merto brief: J (said "booked" when it was only requested),
-- K (promised a sold truck), E (missed call, then a payment quote), I (opt-out),
-- and C (price question handed to a rep: the AI handles it correctly).
begin;

insert into public.buyers (id, name, email, phone, preferred_channel, opted_out, created_at) values
  ('20000000-0000-0000-0000-000000000005', 'Maya Desai', null, '416-555-0105', 'sms', false, now() - interval '6 days'),
  ('20000000-0000-0000-0000-000000000006', 'Chris Patel', 'chris@example.com', '416-555-0106', 'sms', false, now() - interval '8 days'),
  ('20000000-0000-0000-0000-000000000007', 'Ben Okafor', null, '416-555-0107', 'sms', false, now() - interval '1 day'),
  ('20000000-0000-0000-0000-000000000008', 'Marcus Johnson', 'marcus@example.com', null, 'email', false, now() - interval '3 days')
on conflict (id) do nothing;

insert into public.deals (id, buyer_id, owner_id, vehicle_interest, source, stage, lost_reason, created_at) values
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 'Used Honda Accord', 'sms', 'visited', null, now() - interval '6 days'),
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000003', 'Used Toyota Tacoma', 'website', 'lost', 'no matching car', now() - interval '8 days'),
  ('30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000007', null, 'Used Mazda CX-5', 'call', 'engaged', null, now() - interval '1 day'),
  ('30000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000003', 'Used Ford F-150', 'listing_portal', 'working', null, now() - interval '3 days')
on conflict (id) do nothing;

insert into public.timeline_events (id, deal_id, actor_type, actor_id, channel, direction, body, created_at) values
  -- Maya: the AI says she is booked, but only a request was saved.
  ('40000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000005', 'buyer', null, 'sms', 'inbound', 'Can I come in Monday at 10 am to see the Accord?', now() - interval '6 days'),
  ('40000000-0000-0000-0000-000000000012', '30000000-0000-0000-0000-000000000005', 'ai', null, 'sms', 'outbound', '[Simulated] You''re all set for Monday at 10! See you then.', now() - interval '6 days' + interval '2 minutes'),
  ('40000000-0000-0000-0000-000000000013', '30000000-0000-0000-0000-000000000005', 'rep', '10000000-0000-0000-0000-000000000002', 'note', 'internal', 'Maya arrived at 9:40 for a visit nobody had confirmed. Took her on a test drive anyway.', now() - interval '5 days'),
  -- Chris: the AI promises a truck that sold the day before.
  ('40000000-0000-0000-0000-000000000014', '30000000-0000-0000-0000-000000000006', 'buyer', null, 'web', 'inbound', 'Is the used Tacoma from your website still there?', now() - interval '8 days'),
  ('40000000-0000-0000-0000-000000000015', '30000000-0000-0000-0000-000000000006', 'ai', null, 'sms', 'outbound', '[Simulated] Yes, it''s definitely here. Come by anytime!', now() - interval '8 days' + interval '1 minute'),
  ('40000000-0000-0000-0000-000000000016', '30000000-0000-0000-0000-000000000006', 'rep', '10000000-0000-0000-0000-000000000003', 'call', 'outbound', 'Called Chris: the Tacoma sold the day before he asked. He was upset.', now() - interval '7 days'),
  ('40000000-0000-0000-0000-000000000017', '30000000-0000-0000-0000-000000000006', 'rep', '10000000-0000-0000-0000-000000000003', 'note', 'internal', 'Chris declined the other trucks. Marked lost: no matching car.', now() - interval '5 days'),
  -- Ben: after a missed call he asks for a person; the AI quotes a payment instead.
  ('40000000-0000-0000-0000-000000000018', '30000000-0000-0000-0000-000000000007', 'buyer', null, 'call', 'inbound', 'Missed call to the store line at 7:55 pm. No one picked up.', now() - interval '1 day'),
  ('40000000-0000-0000-0000-000000000019', '30000000-0000-0000-0000-000000000007', 'ai', null, 'sms', 'outbound', '[Simulated] Sorry we missed your call!! Which vehicle are you interested in?', now() - interval '1 day' + interval '1 minute'),
  ('40000000-0000-0000-0000-000000000020', '30000000-0000-0000-0000-000000000007', 'buyer', null, 'sms', 'inbound', 'The used CX-5. What would my payment be? Can I just talk to a real person?', now() - interval '1 day' + interval '10 minutes'),
  ('40000000-0000-0000-0000-000000000021', '30000000-0000-0000-0000-000000000007', 'ai', null, 'sms', 'outbound', '[Simulated] With $2,000 down you''d be around $389/month. Hurry, this deal won''t last!', now() - interval '1 day' + interval '11 minutes'),
  -- Rob: AI contact before his opt-out in seed.sql is allowed.
  ('40000000-0000-0000-0000-000000000022', '30000000-0000-0000-0000-000000000004', 'ai', null, 'email', 'outbound', '[Simulated] Thanks for your interest in the CX-5. Would you like to book a test drive?', now() - interval '4 days'),
  ('40000000-0000-0000-0000-000000000023', '30000000-0000-0000-0000-000000000004', 'buyer', null, 'email', 'inbound', 'What is the mileage on it?', now() - interval '4 days' + interval '1 hour'),
  -- Marcus: asks for the full price; the AI does not guess and hands it to Arjun.
  ('40000000-0000-0000-0000-000000000024', '30000000-0000-0000-0000-000000000008', 'buyer', null, 'web', 'inbound', 'Listing-site lead: used F-150. Contact by email only.', now() - interval '3 days'),
  ('40000000-0000-0000-0000-000000000025', '30000000-0000-0000-0000-000000000008', 'ai', null, 'email', 'outbound', '[Simulated] Thanks for your interest in the F-150. When would you like to see it?', now() - interval '3 days' + interval '5 minutes'),
  ('40000000-0000-0000-0000-000000000026', '30000000-0000-0000-0000-000000000008', 'buyer', null, 'email', 'inbound', 'What is the full price out the door?', now() - interval '2 days'),
  ('40000000-0000-0000-0000-000000000027', '30000000-0000-0000-0000-000000000008', 'ai', null, 'email', 'outbound', '[Simulated] I won''t guess at a number. I''ve asked Arjun to email you the full quote today.', now() - interval '2 days' + interval '3 minutes'),
  ('40000000-0000-0000-0000-000000000028', '30000000-0000-0000-0000-000000000008', 'rep', '10000000-0000-0000-0000-000000000003', 'email', 'outbound', '[Simulated] Here is your full quote for the F-150.', now() - interval '2 days' + interval '2 hours')
on conflict (id) do nothing;

-- Maya's visit stayed a request: no person ever confirmed it.
insert into public.appointments (id, deal_id, scheduled_for, status, confirmed_by, confirmed_at) values
  ('50000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000005', now() - interval '5 days', 'requested', null, null)
on conflict (id) do nothing;

-- The to-do the AI created for Marcus's price question; Arjun sent the quote.
insert into public.open_items (id, deal_id, owner_id, type, description, status, due_at, created_at, resolved_at) values
  ('60000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000003', 'unanswered_question', 'Email Marcus the out-the-door quote for the F-150.', 'resolved', now() - interval '1 day', now() - interval '2 days' + interval '3 minutes', now() - interval '2 days' + interval '2 hours')
on conflict (id) do nothing;

commit;
