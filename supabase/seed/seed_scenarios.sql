-- Fictional Northgate Motors (Toronto) scenario variants A-M.
-- Human labels live in backend/test/fixtures/scenario-labels.json.
-- All email addresses and 416-555-01xx numbers are simulated.
-- Variant 1 completes each story; variant 2 usually stops at active work.
-- I.3 shares I.1's buyer to exercise opt-out across deals and channels.
-- Only Sofia/Tom use the explicitly requested staff IDs ...004/...005;
-- every other new table ID range begins at ...101.
-- Schema limits: AI mode, sick leave, reception, inventory, trade appraisals,
-- stage transitions, F&I and delivery are narrative internal notes.
-- Backfilled visits retain the person's original confirmation time.
begin;

insert into public.staff_users (id, name, role, email) values
  ('10000000-0000-0000-0000-000000000004', 'Sofia Reyes', 'rep', 'sofia@example.com'),
  ('10000000-0000-0000-0000-000000000005', 'Tom Brennan', 'rep', 'tom@example.com')
on conflict (id) do nothing;

insert into public.buyers (id, name, email, phone, preferred_channel, opted_out, created_at) values
  ('20000000-0000-0000-0000-000000000101', 'Elena Brooks', 'elena.brooks@example.com', '416-555-0111', 'sms', false, now() - interval '14 days'),
  ('20000000-0000-0000-0000-000000000102', 'Miles Chen', 'miles.chen@example.com', '416-555-0112', 'sms', false, now() - interval '5 days'),
  ('20000000-0000-0000-0000-000000000103', 'Nora Ellis', 'nora.ellis@example.com', '416-555-0113', 'call', false, now() - interval '8 days'),
  ('20000000-0000-0000-0000-000000000104', 'Owen Farah', 'owen.farah@example.com', '416-555-0114', 'email', false, now() - interval '1 days'),
  ('20000000-0000-0000-0000-000000000105', 'Priya Dunn', 'priya.dunn@example.com', null, 'email', false, now() - interval '12 days'),
  ('20000000-0000-0000-0000-000000000106', 'Theo Grant', 'theo.grant@example.com', null, 'email', false, now() - interval '7 days'),
  ('20000000-0000-0000-0000-000000000107', 'Aisha Cole', 'aisha.cole@example.com', '416-555-0117', 'sms', false, now() - interval '10 days'),
  ('20000000-0000-0000-0000-000000000108', 'Callum Reed', 'callum.reed@example.com', '416-555-0118', 'sms', false, now() - interval '3 days'),
  ('20000000-0000-0000-0000-000000000109', 'Dylan Park', null, '416-555-0119', 'sms', false, now() - interval '11 days'),
  ('20000000-0000-0000-0000-000000000110', 'Imani Blake', 'imani.blake@example.com', '416-555-0120', 'sms', false, now() - interval '5 days'),
  ('20000000-0000-0000-0000-000000000111', 'Jonah Vale', 'jonah.vale@example.com', '416-555-0121', 'email', false, now() - interval '52 days'),
  ('20000000-0000-0000-0000-000000000112', 'Keira Moss', 'keira.moss@example.com', '416-555-0122', 'sms', false, now() - interval '48 days'),
  ('20000000-0000-0000-0000-000000000113', 'Luca West', 'luca.west@example.com', '416-555-0123', 'email', false, now() - interval '20 days'),
  ('20000000-0000-0000-0000-000000000114', 'Maren Fox', 'maren.fox@example.com', '416-555-0124', 'email', false, now() - interval '12 days'),
  ('20000000-0000-0000-0000-000000000115', 'Nikhil Stone', 'nikhil.stone@example.com', '416-555-0125', 'sms', false, now() - interval '10 days'),
  ('20000000-0000-0000-0000-000000000116', 'Olivia Hart', 'olivia.hart@example.com', '416-555-0126', 'sms', false, now() - interval '5 days'),
  ('20000000-0000-0000-0000-000000000117', 'Parker Wynn', 'parker.wynn@example.com', '416-555-0127', 'sms', true, now() - interval '7 days'),
  ('20000000-0000-0000-0000-000000000118', 'Quinn Shaw', 'quinn.shaw@example.com', '416-555-0128', 'email', true, now() - interval '5 days'),
  ('20000000-0000-0000-0000-000000000119', 'Rhea Sutton', 'rhea.sutton@example.com', '416-555-0129', 'sms', false, now() - interval '8 days'),
  ('20000000-0000-0000-0000-000000000120', 'Samir Bell', 'samir.bell@example.com', '416-555-0130', 'sms', false, now() - interval '2 days'),
  ('20000000-0000-0000-0000-000000000121', 'Tessa Lane', 'tessa.lane@example.com', '416-555-0131', 'sms', false, now() - interval '8 days'),
  ('20000000-0000-0000-0000-000000000122', 'Uri Khan', 'uri.khan@example.com', '416-555-0132', 'sms', false, now() - interval '3 days'),
  ('20000000-0000-0000-0000-000000000123', 'Vera Lin', 'vera.lin@example.com', '416-555-0133', 'email', false, now() - interval '6 days'),
  ('20000000-0000-0000-0000-000000000124', 'Wes Patel', 'wes.patel@example.com', '416-555-0134', 'email', false, now() - interval '3 days'),
  ('20000000-0000-0000-0000-000000000125', 'Xander Finch', 'xander.finch@example.com', '416-555-0135', 'email', false, now() - interval '4 days'),
  ('20000000-0000-0000-0000-000000000126', 'Yara Quinn', 'yara.quinn@example.com', '416-555-0136', 'email', false, now() - interval '2 days')
on conflict (id) do nothing;

insert into public.deals (id, buyer_id, owner_id, vehicle_interest, source, stage, lost_reason, created_at) values
  ('30000000-0000-0000-0000-000000000101', '20000000-0000-0000-0000-000000000101', '10000000-0000-0000-0000-000000000002', '2022 Toyota RAV4 XLE', 'website', 'delivered', null, now() - interval '14 days'),
  ('30000000-0000-0000-0000-000000000102', '20000000-0000-0000-0000-000000000102', '10000000-0000-0000-0000-000000000002', '2021 Subaru Forester Touring', 'web chat', 'fni', null, now() - interval '5 days'),
  ('30000000-0000-0000-0000-000000000103', '20000000-0000-0000-0000-000000000103', '10000000-0000-0000-0000-000000000004', '2020 Honda Fit EX', 'walk_in', 'delivered', null, now() - interval '8 days'),
  ('30000000-0000-0000-0000-000000000104', '20000000-0000-0000-0000-000000000104', '10000000-0000-0000-0000-000000000005', '2023 Kia Soul EX', 'walk_in', 'working', null, now() - interval '1 days'),
  ('30000000-0000-0000-0000-000000000105', '20000000-0000-0000-0000-000000000105', '10000000-0000-0000-0000-000000000003', '2022 Volkswagen Golf Comfortline', 'listing_portal', 'delivered', null, now() - interval '12 days'),
  ('30000000-0000-0000-0000-000000000106', '20000000-0000-0000-0000-000000000106', '10000000-0000-0000-0000-000000000004', '2021 Hyundai Elantra Preferred', 'listing_portal', 'working', null, now() - interval '7 days'),
  ('30000000-0000-0000-0000-000000000107', '20000000-0000-0000-0000-000000000107', '10000000-0000-0000-0000-000000000005', '2024 Nissan Rogue SV', 'store_email_and_rep_mobile', 'delivered', null, now() - interval '10 days'),
  ('30000000-0000-0000-0000-000000000108', '20000000-0000-0000-0000-000000000108', '10000000-0000-0000-0000-000000000003', '2023 Honda Civic Sport', 'store_email_and_rep_mobile', 'visited', null, now() - interval '3 days'),
  ('30000000-0000-0000-0000-000000000109', '20000000-0000-0000-0000-000000000109', '10000000-0000-0000-0000-000000000002', '2021 Mazda CX-5 GS', 'missed_call', 'delivered', null, now() - interval '11 days'),
  ('30000000-0000-0000-0000-000000000110', '20000000-0000-0000-0000-000000000110', '10000000-0000-0000-0000-000000000004', '2022 Chevrolet Equinox LT', 'missed_call', 'appointment_set', null, now() - interval '5 days'),
  ('30000000-0000-0000-0000-000000000111', '20000000-0000-0000-0000-000000000111', '10000000-0000-0000-0000-000000000002', '2020 Toyota Corolla LE', 'email', 'delivered', null, now() - interval '52 days'),
  ('30000000-0000-0000-0000-000000000112', '20000000-0000-0000-0000-000000000112', '10000000-0000-0000-0000-000000000004', '2021 Ford Escape SE', 'sms', 'engaged', null, now() - interval '48 days'),
  ('30000000-0000-0000-0000-000000000113', '20000000-0000-0000-0000-000000000113', '10000000-0000-0000-0000-000000000003', '2022 Kia Sportage LX', 'website', 'delivered', null, now() - interval '20 days'),
  ('30000000-0000-0000-0000-000000000114', '20000000-0000-0000-0000-000000000114', '10000000-0000-0000-0000-000000000004', '2023 Mitsubishi Outlander ES', 'phone', 'fni', null, now() - interval '12 days'),
  ('30000000-0000-0000-0000-000000000115', '20000000-0000-0000-0000-000000000115', '10000000-0000-0000-0000-000000000002', '2022 Hyundai Santa Fe Preferred', 'walk_in', 'lost', 'bought elsewhere', now() - interval '10 days'),
  ('30000000-0000-0000-0000-000000000116', '20000000-0000-0000-0000-000000000116', '10000000-0000-0000-0000-000000000003', '2021 Lexus NX 300', 'website', 'working', null, now() - interval '5 days'),
  ('30000000-0000-0000-0000-000000000117', '20000000-0000-0000-0000-000000000117', '10000000-0000-0000-0000-000000000004', '2021 Honda CR-V LX', 'sms', 'lost', 'opted out', now() - interval '6 days'),
  ('30000000-0000-0000-0000-000000000118', '20000000-0000-0000-0000-000000000118', '10000000-0000-0000-0000-000000000005', '2020 Subaru Crosstrek', 'email', 'lost', 'opted out', now() - interval '5 days'),
  ('30000000-0000-0000-0000-000000000119', '20000000-0000-0000-0000-000000000117', '10000000-0000-0000-0000-000000000003', '2022 Toyota Camry SE', 'website', 'lost', 'opted out', now() - interval '7 days'),
  ('30000000-0000-0000-0000-000000000120', '20000000-0000-0000-0000-000000000119', '10000000-0000-0000-0000-000000000003', '2021 Acura RDX', 'sms', 'delivered', null, now() - interval '8 days'),
  ('30000000-0000-0000-0000-000000000121', '20000000-0000-0000-0000-000000000120', '10000000-0000-0000-0000-000000000004', '2022 Volvo XC40 T4', 'sms', 'appointment_set', null, now() - interval '2 days'),
  ('30000000-0000-0000-0000-000000000122', '20000000-0000-0000-0000-000000000121', '10000000-0000-0000-0000-000000000002', '2021 Ford F-150 XLT', 'website', 'lost', 'no matching car', now() - interval '8 days'),
  ('30000000-0000-0000-0000-000000000123', '20000000-0000-0000-0000-000000000122', '10000000-0000-0000-0000-000000000005', '2020 Ram 1500 Big Horn', 'listing_portal', 'engaged', null, now() - interval '3 days'),
  ('30000000-0000-0000-0000-000000000124', '20000000-0000-0000-0000-000000000123', null, '2021 Nissan Sentra SV', 'email', 'lost', 'could not reach', now() - interval '6 days'),
  ('30000000-0000-0000-0000-000000000125', '20000000-0000-0000-0000-000000000124', null, '2022 Buick Encore GX', 'email', 'new', null, now() - interval '3 days'),
  ('30000000-0000-0000-0000-000000000126', '20000000-0000-0000-0000-000000000125', null, 'No vehicle interest - SEO services vendor', 'store_email', 'lost', 'not a buyer', now() - interval '4 days'),
  ('30000000-0000-0000-0000-000000000127', '20000000-0000-0000-0000-000000000126', null, 'No vehicle interest - SEO audit vendor', 'store_email', 'lost', 'not a buyer', now() - interval '2 days')
on conflict (id) do nothing;

-- A.1: A late-night web lead reaches Dana, attends a confirmed visit, supplies insurance and takes delivery before a rep-approved check-in.
insert into public.timeline_events (id, deal_id, event_type, actor_type, actor_id, channel, direction, body, created_at) values
  ('40000000-0000-0000-0000-000000000101', '30000000-0000-0000-0000-000000000101', 'interaction', 'buyer', null, 'web', 'inbound', 'Just got home from work. Could I see the blue RAV4 later this week?', now() - interval '14 days'),
  ('40000000-0000-0000-0000-000000000102', '30000000-0000-0000-0000-000000000101', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] Thanks for reaching Northgate Motors in Toronto. The sales team is away for the night; what time would suit you?', now() - interval '13 days' - interval '23 hours' - interval '59 minutes'),
  ('40000000-0000-0000-0000-000000000103', '30000000-0000-0000-0000-000000000101', 'interaction', 'buyer', null, 'sms', 'inbound', 'Tomorrow afternoon would be easiest.', now() - interval '13 days' - interval '23 hours' - interval '50 minutes'),
  ('40000000-0000-0000-0000-000000000104', '30000000-0000-0000-0000-000000000101', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] I''ve asked Dana to confirm the time; please wait for her reply before heading over.', now() - interval '13 days' - interval '23 hours' - interval '49 minutes'),
  ('40000000-0000-0000-0000-000000000105', '30000000-0000-0000-0000-000000000101', 'assignment', 'gm', '10000000-0000-0000-0000-000000000001', 'note', 'internal', 'Assigned Elena to Dana after the overnight web lead.', now() - interval '13 days' - interval '16 hours'),
  ('40000000-0000-0000-0000-000000000106', '30000000-0000-0000-0000-000000000101', 'interaction', 'rep', '10000000-0000-0000-0000-000000000002', 'sms', 'outbound', '[Simulated] I have confirmed your visit for tomorrow afternoon. Ask for Dana when you arrive.', now() - interval '13 days' - interval '15 hours'),
  ('40000000-0000-0000-0000-000000000107', '30000000-0000-0000-0000-000000000101', 'interaction', 'rep', '10000000-0000-0000-0000-000000000002', 'note', 'internal', 'Elena visited, drove the RAV4 and agreed to purchase.', now() - interval '12 days'),
  ('40000000-0000-0000-0000-000000000108', '30000000-0000-0000-0000-000000000101', 'interaction', 'system', null, 'note', 'internal', 'Omar Haddad (F&I) requested proof of insurance before delivery.', now() - interval '11 days' - interval '23 hours'),
  ('40000000-0000-0000-0000-000000000109', '30000000-0000-0000-0000-000000000101', 'interaction', 'buyer', null, 'email', 'inbound', 'I have sent Omar the insurance document.', now() - interval '11 days'),
  ('40000000-0000-0000-0000-000000000110', '30000000-0000-0000-0000-000000000101', 'interaction', 'system', null, 'note', 'internal', 'Grace Kim (delivery) handed Elena the keys and reviewed the controls.', now() - interval '10 days'),
  ('40000000-0000-0000-0000-000000000111', '30000000-0000-0000-0000-000000000101', 'interaction', 'rep', '10000000-0000-0000-0000-000000000002', 'sms', 'outbound', '[Simulated] How is the RAV4 settling in? Let me know if you need a hand with the phone pairing.', now() - interval '9 days')
on conflict (id) do nothing;

-- A.2: Dana confirms an overnight Forester lead and hosts the visit; the insurance document remains outstanding.
insert into public.timeline_events (id, deal_id, event_type, actor_type, actor_id, channel, direction, body, created_at) values
  ('40000000-0000-0000-0000-000000000112', '30000000-0000-0000-0000-000000000102', 'interaction', 'buyer', null, 'web', 'inbound', 'Looking at the silver Forester after my shift. Is a visit possible?', now() - interval '5 days'),
  ('40000000-0000-0000-0000-000000000113', '30000000-0000-0000-0000-000000000102', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] We are closed for the evening. Send a time that suits you and Dana can check the diary.', now() - interval '4 days' - interval '23 hours' - interval '59 minutes' - interval '20 seconds'),
  ('40000000-0000-0000-0000-000000000114', '30000000-0000-0000-0000-000000000102', 'interaction', 'buyer', null, 'sms', 'inbound', 'Could I come in the next afternoon?', now() - interval '4 days' - interval '23 hours' - interval '55 minutes'),
  ('40000000-0000-0000-0000-000000000115', '30000000-0000-0000-0000-000000000102', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] Let me check whether the Forester is still available. Dana can confirm the visit time.', now() - interval '4 days' - interval '23 hours' - interval '54 minutes'),
  ('40000000-0000-0000-0000-000000000116', '30000000-0000-0000-0000-000000000102', 'assignment', 'gm', '10000000-0000-0000-0000-000000000001', 'note', 'internal', 'Assigned Miles to Dana for the used Forester.', now() - interval '4 days' - interval '16 hours'),
  ('40000000-0000-0000-0000-000000000117', '30000000-0000-0000-0000-000000000102', 'interaction', 'rep', '10000000-0000-0000-0000-000000000002', 'sms', 'outbound', '[Simulated] I have confirmed your afternoon visit for tomorrow.', now() - interval '4 days' - interval '15 hours'),
  ('40000000-0000-0000-0000-000000000118', '30000000-0000-0000-0000-000000000102', 'interaction', 'rep', '10000000-0000-0000-0000-000000000002', 'note', 'internal', 'Miles attended the confirmed visit and chose the Forester.', now() - interval '3 days'),
  ('40000000-0000-0000-0000-000000000119', '30000000-0000-0000-0000-000000000102', 'interaction', 'system', null, 'note', 'internal', 'Omar Haddad (F&I) requested proof of insurance before releasing the Forester.', now() - interval '2 days' - interval '23 hours'),
  ('40000000-0000-0000-0000-000000000120', '30000000-0000-0000-0000-000000000102', 'interaction', 'rep', '10000000-0000-0000-0000-000000000002', 'sms', 'outbound', '[Simulated] Checking in on the insurance document for Omar. Reply when you have a moment.', now() - interval '2 days')
on conflict (id) do nothing;

-- B.1: Leah logs a walk-in, Sofia handles the purchase and Grace delivers the Fit that same day, with no AI messages.
insert into public.timeline_events (id, deal_id, event_type, actor_type, actor_id, channel, direction, body, created_at) values
  ('40000000-0000-0000-0000-000000000121', '30000000-0000-0000-0000-000000000103', 'interaction', 'buyer', null, 'in_person', 'inbound', 'I was passing by and wanted to look at that little Honda.', now() - interval '8 days'),
  ('40000000-0000-0000-0000-000000000122', '30000000-0000-0000-0000-000000000103', 'interaction', 'system', null, 'note', 'internal', 'Leah Morgan (BDC) logged Nora at reception and introduced her to Sofia Reyes.', now() - interval '7 days' - interval '23 hours' - interval '59 minutes'),
  ('40000000-0000-0000-0000-000000000123', '30000000-0000-0000-0000-000000000103', 'interaction', 'buyer', null, 'in_person', 'inbound', 'How much longer will the test drive take?', now() - interval '7 days' - interval '23 hours'),
  ('40000000-0000-0000-0000-000000000124', '30000000-0000-0000-0000-000000000103', 'interaction', 'rep', '10000000-0000-0000-0000-000000000004', 'note', 'internal', 'Nora accepted the written offer and signed the purchase papers after her test drive.', now() - interval '7 days' - interval '21 hours'),
  ('40000000-0000-0000-0000-000000000125', '30000000-0000-0000-0000-000000000103', 'interaction', 'system', null, 'note', 'internal', 'Grace Kim (delivery) completed the handover; Nora drove the Fit home the same day.', now() - interval '7 days' - interval '18 hours')
on conflict (id) do nothing;

-- B.2: Tom handles a same-day walk-in purchase; Grace is waiting for the final handover paperwork, with no AI involvement.
insert into public.timeline_events (id, deal_id, event_type, actor_type, actor_id, channel, direction, body, created_at) values
  ('40000000-0000-0000-0000-000000000126', '30000000-0000-0000-0000-000000000104', 'interaction', 'buyer', null, 'in_person', 'inbound', 'I came in for the Soul I saw through the window.', now() - interval '1 days'),
  ('40000000-0000-0000-0000-000000000127', '30000000-0000-0000-0000-000000000104', 'interaction', 'system', null, 'note', 'internal', 'Leah Morgan (BDC) recorded the walk-in and introduced Owen to Tom Brennan, the part-time rep.', now() - interval '23 hours' - interval '58 minutes'),
  ('40000000-0000-0000-0000-000000000128', '30000000-0000-0000-0000-000000000104', 'interaction', 'rep', '10000000-0000-0000-0000-000000000005', 'note', 'internal', 'Owen signed the purchase agreement today; payment has cleared and final handover paperwork is pending.', now() - interval '21 hours'),
  ('40000000-0000-0000-0000-000000000129', '30000000-0000-0000-0000-000000000104', 'interaction', 'system', null, 'note', 'internal', 'Grace Kim (delivery) is arranging collection after the registration paperwork is ready.', now() - interval '20 hours')
on conflict (id) do nothing;

-- C.1: Arjun sends an approved AI draft, supplies the Golf quote, follows up after three silent days and completes the sale.
insert into public.timeline_events (id, deal_id, event_type, actor_type, actor_id, channel, direction, body, created_at) values
  ('40000000-0000-0000-0000-000000000130', '30000000-0000-0000-0000-000000000105', 'interaction', 'buyer', null, 'email', 'inbound', 'The Golf listing sent me here. Email only, please.', now() - interval '12 days'),
  ('40000000-0000-0000-0000-000000000131', '30000000-0000-0000-0000-000000000105', 'interaction', 'system', null, 'note', 'internal', 'Email AI mode is draft only. Arjun must approve and send every customer email on this deal.', now() - interval '11 days' - interval '23 hours' - interval '59 minutes'),
  ('40000000-0000-0000-0000-000000000132', '30000000-0000-0000-0000-000000000105', 'interaction', 'buyer', null, 'email', 'inbound', 'Send me the out the door number.', now() - interval '11 days' - interval '23 hours' - interval '55 minutes'),
  ('40000000-0000-0000-0000-000000000133', '30000000-0000-0000-0000-000000000105', 'interaction', 'rep', '10000000-0000-0000-0000-000000000003', 'email', 'outbound', '[Simulated] I won''t guess at the total. I have a task to send you an itemized quote today.', now() - interval '11 days' - interval '23 hours' - interval '50 minutes'),
  ('40000000-0000-0000-0000-000000000134', '30000000-0000-0000-0000-000000000105', 'interaction', 'rep', '10000000-0000-0000-0000-000000000003', 'email', 'outbound', '[Simulated] The total is $24,850 including tax, licensing and the listed fees. The itemized quote is attached.', now() - interval '11 days' - interval '23 hours'),
  ('40000000-0000-0000-0000-000000000135', '30000000-0000-0000-0000-000000000105', 'interaction', 'rep', '10000000-0000-0000-0000-000000000003', 'email', 'outbound', '[Simulated] Following up on the Golf quote I emailed three days ago. Would you like me to explain any of the lines?', now() - interval '8 days' - interval '23 hours'),
  ('40000000-0000-0000-0000-000000000136', '30000000-0000-0000-0000-000000000105', 'interaction', 'buyer', null, 'email', 'inbound', 'Thanks for leaving me time to think. I accept the quote.', now() - interval '8 days'),
  ('40000000-0000-0000-0000-000000000137', '30000000-0000-0000-0000-000000000105', 'interaction', 'system', null, 'note', 'internal', 'Grace Kim (delivery) recorded the Golf handover after Arjun completed the signed agreement.', now() - interval '6 days')
on conflict (id) do nothing;

-- C.2: Sofia handles an email-only draft workflow and follows up on the Elantra quote after three days; the buyer is considering it.
insert into public.timeline_events (id, deal_id, event_type, actor_type, actor_id, channel, direction, body, created_at) values
  ('40000000-0000-0000-0000-000000000138', '30000000-0000-0000-0000-000000000106', 'interaction', 'buyer', null, 'email', 'inbound', 'Please use email for the Elantra enquiry; I cannot take calls at work.', now() - interval '7 days'),
  ('40000000-0000-0000-0000-000000000139', '30000000-0000-0000-0000-000000000106', 'interaction', 'system', null, 'note', 'internal', 'Email AI is draft only. Sofia reviews the proposed wording and sends the emails herself.', now() - interval '6 days' - interval '23 hours' - interval '59 minutes' - interval '30 seconds'),
  ('40000000-0000-0000-0000-000000000140', '30000000-0000-0000-0000-000000000106', 'interaction', 'buyer', null, 'email', 'inbound', 'what are you asking for it', now() - interval '6 days' - interval '23 hours' - interval '57 minutes'),
  ('40000000-0000-0000-0000-000000000141', '30000000-0000-0000-0000-000000000106', 'interaction', 'rep', '10000000-0000-0000-0000-000000000004', 'email', 'outbound', '[Simulated] I will send the full breakdown after checking the fees. I have added that to my list.', now() - interval '6 days' - interval '23 hours' - interval '55 minutes'),
  ('40000000-0000-0000-0000-000000000142', '30000000-0000-0000-0000-000000000106', 'interaction', 'rep', '10000000-0000-0000-0000-000000000004', 'email', 'outbound', '[Simulated] Your itemized total is $21,420 including tax and licensing; see the attached breakdown.', now() - interval '6 days' - interval '22 hours'),
  ('40000000-0000-0000-0000-000000000143', '30000000-0000-0000-0000-000000000106', 'interaction', 'rep', '10000000-0000-0000-0000-000000000004', 'email', 'outbound', '[Simulated] It has been three days since my quote. Is there anything you would like clarified?', now() - interval '3 days' - interval '22 hours'),
  ('40000000-0000-0000-0000-000000000144', '30000000-0000-0000-0000-000000000106', 'interaction', 'buyer', null, 'email', 'inbound', 'I''ll talk to my wife first.', now() - interval '3 days')
on conflict (id) do nothing;

-- D.1: Aisha contacts Sofia through two channels; Karen transfers the sick rep’s deal and callback to Tom, who completes the sale.
insert into public.timeline_events (id, deal_id, event_type, actor_type, actor_id, channel, direction, body, created_at) values
  ('40000000-0000-0000-0000-000000000145', '30000000-0000-0000-0000-000000000107', 'interaction', 'buyer', null, 'email', 'inbound', 'I emailed the store about the Rogue. Sofia helped my sister.', now() - interval '10 days'),
  ('40000000-0000-0000-0000-000000000146', '30000000-0000-0000-0000-000000000107', 'interaction', 'buyer', null, 'sms', 'inbound', 'This is Aisha from that email. Put me through to Sofia, please.', now() - interval '9 days' - interval '23 hours' - interval '58 minutes'),
  ('40000000-0000-0000-0000-000000000147', '30000000-0000-0000-0000-000000000107', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] I can pass on your request so someone can pick it up while Sofia is away.', now() - interval '9 days' - interval '23 hours' - interval '57 minutes'),
  ('40000000-0000-0000-0000-000000000148', '30000000-0000-0000-0000-000000000107', 'transfer', 'gm', '10000000-0000-0000-0000-000000000001', 'note', 'internal', 'Sofia is off sick. Transferred Aisha from Sofia to Tom and moved the outstanding callback to Tom.', now() - interval '9 days' - interval '23 hours'),
  ('40000000-0000-0000-0000-000000000149', '30000000-0000-0000-0000-000000000107', 'interaction', 'rep', '10000000-0000-0000-0000-000000000005', 'sms', 'outbound', '[Simulated] Sofia is off sick, so I am your contact. I have confirmed a Rogue visit for tomorrow.', now() - interval '9 days' - interval '22 hours'),
  ('40000000-0000-0000-0000-000000000150', '30000000-0000-0000-0000-000000000107', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] Tom will check the Rogue’s availability before your visit.', now() - interval '9 days' - interval '21 hours' - interval '59 minutes'),
  ('40000000-0000-0000-0000-000000000151', '30000000-0000-0000-0000-000000000107', 'interaction', 'system', null, 'note', 'internal', 'Grace Kim (delivery) recorded the Rogue handover following Tom’s visit and signed sale.', now() - interval '7 days')
on conflict (id) do nothing;

-- D.2: Callum reaches Dana’s mobile after emailing the store; Karen moves the sick rep’s deal and callback to Arjun, and a visit is confirmed.
insert into public.timeline_events (id, deal_id, event_type, actor_type, actor_id, channel, direction, body, created_at) values
  ('40000000-0000-0000-0000-000000000152', '30000000-0000-0000-0000-000000000108', 'interaction', 'buyer', null, 'email', 'inbound', 'Checking on the Civic. I have also sent this to the main inbox.', now() - interval '3 days'),
  ('40000000-0000-0000-0000-000000000153', '30000000-0000-0000-0000-000000000108', 'interaction', 'buyer', null, 'sms', 'inbound', 'Dana, is there someone I can call while you are away?', now() - interval '2 days' - interval '23 hours' - interval '58 minutes' - interval '30 seconds'),
  ('40000000-0000-0000-0000-000000000154', '30000000-0000-0000-0000-000000000108', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] I have asked the manager to arrange a person for you.', now() - interval '2 days' - interval '23 hours' - interval '58 minutes'),
  ('40000000-0000-0000-0000-000000000155', '30000000-0000-0000-0000-000000000108', 'transfer', 'gm', '10000000-0000-0000-0000-000000000001', 'note', 'internal', 'Dana is off sick. Transferred Callum from Dana to Arjun; the callback now belongs to Arjun.', now() - interval '2 days' - interval '23 hours'),
  ('40000000-0000-0000-0000-000000000156', '30000000-0000-0000-0000-000000000108', 'interaction', 'rep', '10000000-0000-0000-0000-000000000003', 'sms', 'outbound', '[Simulated] I am covering for Dana. I can call this afternoon, and I have confirmed your visit for tomorrow.', now() - interval '2 days' - interval '22 hours'),
  ('40000000-0000-0000-0000-000000000157', '30000000-0000-0000-0000-000000000108', 'interaction', 'buyer', null, 'sms', 'inbound', 'A call after work is fine.', now() - interval '2 days' - interval '21 hours'),
  ('40000000-0000-0000-0000-000000000158', '30000000-0000-0000-0000-000000000108', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] Thanks, I will leave the details with Arjun.', now() - interval '2 days' - interval '20 hours' - interval '59 minutes'),
  ('40000000-0000-0000-0000-000000000159', '30000000-0000-0000-0000-000000000108', 'interaction', 'rep', '10000000-0000-0000-0000-000000000003', 'call', 'outbound', 'Called Callum after work: answered his questions and checked the confirmed visit details.', now() - interval '2 days' - interval '20 hours'),
  ('40000000-0000-0000-0000-000000000160', '30000000-0000-0000-0000-000000000108', 'interaction', 'rep', '10000000-0000-0000-0000-000000000003', 'note', 'internal', 'Callum attended the confirmed Civic visit and is considering his options.', now() - interval '2 days')
on conflict (id) do nothing;

-- E.1: A missed call receives a prompt text, Dana confirms a visit, and a friendly no-show follow-up brings Dylan back to buy.
insert into public.timeline_events (id, deal_id, event_type, actor_type, actor_id, channel, direction, body, created_at) values
  ('40000000-0000-0000-0000-000000000161', '30000000-0000-0000-0000-000000000109', 'interaction', 'buyer', null, 'call', 'inbound', 'Missed call to Northgate Motors; caller left no voicemail.', now() - interval '11 days'),
  ('40000000-0000-0000-0000-000000000162', '30000000-0000-0000-0000-000000000109', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] Sorry we missed you. Which vehicle did you want to ask about?', now() - interval '10 days' - interval '23 hours' - interval '59 minutes' - interval '25 seconds'),
  ('40000000-0000-0000-0000-000000000163', '30000000-0000-0000-0000-000000000109', 'interaction', 'buyer', null, 'sms', 'inbound', 'The CX-5. Could I visit the next afternoon?', now() - interval '10 days' - interval '23 hours' - interval '55 minutes'),
  ('40000000-0000-0000-0000-000000000164', '30000000-0000-0000-0000-000000000109', 'interaction', 'rep', '10000000-0000-0000-0000-000000000002', 'sms', 'outbound', '[Simulated] I have confirmed the CX-5 visit for tomorrow afternoon. Ask for Dana.', now() - interval '10 days' - interval '23 hours'),
  ('40000000-0000-0000-0000-000000000165', '30000000-0000-0000-0000-000000000109', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] Your visit is confirmed. See you then!', now() - interval '10 days' - interval '22 hours' - interval '59 minutes'),
  ('40000000-0000-0000-0000-000000000166', '30000000-0000-0000-0000-000000000109', 'interaction', 'system', null, 'note', 'internal', 'Leah Morgan (BDC) checked with Dana: Dylan did not attend the person-confirmed visit.', now() - interval '9 days'),
  ('40000000-0000-0000-0000-000000000167', '30000000-0000-0000-0000-000000000109', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] Hope everything is okay. If you would like another time, just reply when convenient.', now() - interval '8 days' - interval '23 hours'),
  ('40000000-0000-0000-0000-000000000168', '30000000-0000-0000-0000-000000000109', 'interaction', 'rep', '10000000-0000-0000-0000-000000000002', 'call', 'outbound', 'Called Dylan: confirmed a replacement visit for tomorrow.', now() - interval '8 days'),
  ('40000000-0000-0000-0000-000000000169', '30000000-0000-0000-0000-000000000109', 'interaction', 'system', null, 'note', 'internal', 'Grace Kim (delivery) completed Dylan’s CX-5 handover after he attended the replacement visit and signed the agreement.', now() - interval '6 days')
on conflict (id) do nothing;

-- E.2: Sofia confirms a missed-call lead who no-shows; a friendly follow-up produces a new confirmed appointment, despite an earlier AI price guess.
insert into public.timeline_events (id, deal_id, event_type, actor_type, actor_id, channel, direction, body, created_at) values
  ('40000000-0000-0000-0000-000000000170', '30000000-0000-0000-0000-000000000110', 'interaction', 'buyer', null, 'call', 'inbound', 'Missed call about the Equinox; reception was serving another customer.', now() - interval '5 days'),
  ('40000000-0000-0000-0000-000000000171', '30000000-0000-0000-0000-000000000110', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] Sorry we could not answer just now. Was it the Equinox you wanted to see?', now() - interval '4 days' - interval '23 hours' - interval '59 minutes' - interval '15 seconds'),
  ('40000000-0000-0000-0000-000000000172', '30000000-0000-0000-0000-000000000110', 'interaction', 'buyer', null, 'sms', 'inbound', 'Yes. Can I come tomorrow morning?', now() - interval '4 days' - interval '23 hours' - interval '56 minutes'),
  ('40000000-0000-0000-0000-000000000173', '30000000-0000-0000-0000-000000000110', 'interaction', 'rep', '10000000-0000-0000-0000-000000000004', 'sms', 'outbound', '[Simulated] Tomorrow morning is confirmed. I will meet you at reception.', now() - interval '4 days' - interval '23 hours'),
  ('40000000-0000-0000-0000-000000000174', '30000000-0000-0000-0000-000000000110', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] You''d be around four hundred a month on that one.', now() - interval '4 days' - interval '22 hours' - interval '59 minutes'),
  ('40000000-0000-0000-0000-000000000175', '30000000-0000-0000-0000-000000000110', 'interaction', 'system', null, 'note', 'internal', 'Leah Morgan (BDC) recorded Imani as a no-show after Sofia checked reception for the confirmed visit.', now() - interval '3 days'),
  ('40000000-0000-0000-0000-000000000176', '30000000-0000-0000-0000-000000000110', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] Looks like that time did not work out. We can look for another day if you would like.', now() - interval '2 days' - interval '23 hours'),
  ('40000000-0000-0000-0000-000000000177', '30000000-0000-0000-0000-000000000110', 'interaction', 'buyer', null, 'sms', 'inbound', 'Thanks for understanding. Could we try next week?', now() - interval '2 days'),
  ('40000000-0000-0000-0000-000000000178', '30000000-0000-0000-0000-000000000110', 'interaction', 'rep', '10000000-0000-0000-0000-000000000004', 'sms', 'outbound', '[Simulated] I have confirmed the replacement visit for next week and sent you the time.', now() - interval '1 days' - interval '23 hours')
on conflict (id) do nothing;

-- F.1: Dana quotes a Corolla, two follow-ups go unanswered, and a day-45 check-in revives the dormant buyer before delivery.
insert into public.timeline_events (id, deal_id, event_type, actor_type, actor_id, channel, direction, body, created_at) values
  ('40000000-0000-0000-0000-000000000179', '30000000-0000-0000-0000-000000000111', 'interaction', 'buyer', null, 'email', 'inbound', 'What''s the damage on the Corolla, all in?', now() - interval '52 days'),
  ('40000000-0000-0000-0000-000000000180', '30000000-0000-0000-0000-000000000111', 'interaction', 'rep', '10000000-0000-0000-0000-000000000002', 'email', 'outbound', '[Simulated] The written total is $20,950 including tax and licensing. I have attached the breakdown.', now() - interval '51 days' - interval '23 hours'),
  ('40000000-0000-0000-0000-000000000181', '30000000-0000-0000-0000-000000000111', 'interaction', 'ai', null, 'email', 'outbound', '[Simulated] Did the Corolla quote reach you? Happy to leave you time to think.', now() - interval '49 days'),
  ('40000000-0000-0000-0000-000000000182', '30000000-0000-0000-0000-000000000111', 'interaction', 'ai', null, 'email', 'outbound', '[Simulated] Would a quick explanation of the paperwork help? Reply whenever it suits you.', now() - interval '45 days'),
  ('40000000-0000-0000-0000-000000000183', '30000000-0000-0000-0000-000000000111', 'interaction', 'system', null, 'note', 'internal', 'No response to either quote follow-up. Deal moved to dormant; no more routine nudges scheduled.', now() - interval '38 days'),
  ('40000000-0000-0000-0000-000000000184', '30000000-0000-0000-0000-000000000111', 'interaction', 'ai', null, 'email', 'outbound', '[Simulated] It has been a while since we spoke. Are you still looking, or would you prefer I leave this here?', now() - interval '7 days'),
  ('40000000-0000-0000-0000-000000000185', '30000000-0000-0000-0000-000000000111', 'interaction', 'buyer', null, 'email', 'inbound', 'Still looking, actually. I can visit tomorrow.', now() - interval '6 days' - interval '23 hours'),
  ('40000000-0000-0000-0000-000000000186', '30000000-0000-0000-0000-000000000111', 'interaction', 'rep', '10000000-0000-0000-0000-000000000002', 'email', 'outbound', '[Simulated] Tomorrow’s visit is confirmed. I will review the options with you.', now() - interval '6 days' - interval '22 hours'),
  ('40000000-0000-0000-0000-000000000187', '30000000-0000-0000-0000-000000000111', 'interaction', 'system', null, 'note', 'internal', 'Grace Kim (delivery) recorded Jonah’s Corolla handover after the return visit and purchase.', now() - interval '4 days')
on conflict (id) do nothing;

-- F.2: Tom’s Escape quote goes quiet after two AI follow-ups; a day-45 check-in revives Keira and Karen transfers the work to Sofia.
insert into public.timeline_events (id, deal_id, event_type, actor_type, actor_id, channel, direction, body, created_at) values
  ('40000000-0000-0000-0000-000000000188', '30000000-0000-0000-0000-000000000112', 'interaction', 'buyer', null, 'sms', 'inbound', 'can u send numbers for the Escape', now() - interval '48 days'),
  ('40000000-0000-0000-0000-000000000189', '30000000-0000-0000-0000-000000000112', 'interaction', 'rep', '10000000-0000-0000-0000-000000000005', 'sms', 'outbound', '[Simulated] The itemized cash total is $25,100 including tax and licensing; financing terms would need a separate review.', now() - interval '47 days' - interval '23 hours'),
  ('40000000-0000-0000-0000-000000000190', '30000000-0000-0000-0000-000000000112', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] Did the Escape quote get through? Let us know if you want to go over any of it.', now() - interval '45 days'),
  ('40000000-0000-0000-0000-000000000191', '30000000-0000-0000-0000-000000000112', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] Any questions about the Escape quote? We can pick this up when you are ready.', now() - interval '41 days'),
  ('40000000-0000-0000-0000-000000000192', '30000000-0000-0000-0000-000000000112', 'interaction', 'system', null, 'note', 'internal', 'Two follow-ups received no reply. Marked dormant while Tom is off his part-time rota.', now() - interval '34 days'),
  ('40000000-0000-0000-0000-000000000193', '30000000-0000-0000-0000-000000000112', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] Checking in after some time away: are you still considering a vehicle?', now() - interval '3 days'),
  ('40000000-0000-0000-0000-000000000194', '30000000-0000-0000-0000-000000000112', 'interaction', 'buyer', null, 'sms', 'inbound', 'Yes, my plans changed. I would like to take another look.', now() - interval '2 days' - interval '23 hours'),
  ('40000000-0000-0000-0000-000000000195', '30000000-0000-0000-0000-000000000112', 'transfer', 'gm', '10000000-0000-0000-0000-000000000001', 'note', 'internal', 'Transferred Keira from part-time Tom to Sofia for the return enquiry; moved the pending callback to Sofia.', now() - interval '2 days' - interval '22 hours')
on conflict (id) do nothing;

-- G.1: Karen chases an unlogged visit; Arjun backfills it, Omar waits a week for income evidence and email reminders lead to delivery.
insert into public.timeline_events (id, deal_id, event_type, actor_type, actor_id, channel, direction, body, created_at) values
  ('40000000-0000-0000-0000-000000000196', '30000000-0000-0000-0000-000000000113', 'interaction', 'buyer', null, 'email', 'inbound', 'I came in yesterday and drove the Sportage. Has anyone saved my visit?', now() - interval '18 days'),
  ('40000000-0000-0000-0000-000000000197', '30000000-0000-0000-0000-000000000113', 'interaction', 'ai', null, 'email', 'outbound', '[Simulated] Thanks for pointing that out. I will ask the team to check the visit record.', now() - interval '17 days' - interval '23 hours' - interval '59 minutes'),
  ('40000000-0000-0000-0000-000000000198', '30000000-0000-0000-0000-000000000113', 'interaction', 'gm', '10000000-0000-0000-0000-000000000001', 'note', 'internal', 'Nudged Arjun to record Luca’s visit; the manager view still showed no visit. Kept Arjun as owner.', now() - interval '17 days' - interval '23 hours'),
  ('40000000-0000-0000-0000-000000000199', '30000000-0000-0000-0000-000000000113', 'interaction', 'rep', '10000000-0000-0000-0000-000000000003', 'note', 'internal', 'Backfilled yesterday’s attended visit. I had personally confirmed it on the previous evening’s call.', now() - interval '17 days' - interval '22 hours'),
  ('40000000-0000-0000-0000-000000000200', '30000000-0000-0000-0000-000000000113', 'interaction', 'system', null, 'note', 'internal', 'Omar Haddad (F&I) requested proof of income; the finance application must wait for that document.', now() - interval '17 days' - interval '21 hours'),
  ('40000000-0000-0000-0000-000000000201', '30000000-0000-0000-0000-000000000113', 'interaction', 'ai', null, 'email', 'outbound', '[Simulated] A reminder that Omar still needs the proof of income. Let us know if you need help finding the document.', now() - interval '15 days'),
  ('40000000-0000-0000-0000-000000000202', '30000000-0000-0000-0000-000000000113', 'interaction', 'ai', null, 'email', 'outbound', '[Simulated] It has been a week since Omar’s request. Can you let us know when the income document might be ready?', now() - interval '10 days' - interval '21 hours'),
  ('40000000-0000-0000-0000-000000000203', '30000000-0000-0000-0000-000000000113', 'interaction', 'buyer', null, 'email', 'inbound', 'I have attached the payslips for Omar. Thanks for bearing with me.', now() - interval '10 days'),
  ('40000000-0000-0000-0000-000000000204', '30000000-0000-0000-0000-000000000113', 'interaction', 'system', null, 'note', 'internal', 'Grace Kim (delivery) recorded the Sportage handover after Omar accepted Luca’s proof of income.', now() - interval '8 days')
on conflict (id) do nothing;

-- G.2: Karen discovers an unlogged Outlander visit and transfers Tom’s work to Sofia; Omar is still waiting after a week of email reminders.
insert into public.timeline_events (id, deal_id, event_type, actor_type, actor_id, channel, direction, body, created_at) values
  ('40000000-0000-0000-0000-000000000205', '30000000-0000-0000-0000-000000000114', 'interaction', 'buyer', null, 'email', 'inbound', 'I visited Tom yesterday. My application still looks untouched.', now() - interval '10 days'),
  ('40000000-0000-0000-0000-000000000206', '30000000-0000-0000-0000-000000000114', 'interaction', 'ai', null, 'email', 'outbound', '[Simulated] Thanks for telling us about the missing visit. I will ask the team to check the record.', now() - interval '9 days' - interval '23 hours' - interval '59 minutes'),
  ('40000000-0000-0000-0000-000000000207', '30000000-0000-0000-0000-000000000114', 'interaction', 'gm', '10000000-0000-0000-0000-000000000001', 'note', 'internal', 'Nudged Tom to enter Maren’s missing visit record; he remains owner until the scheduled handoff.', now() - interval '9 days' - interval '23 hours'),
  ('40000000-0000-0000-0000-000000000208', '30000000-0000-0000-0000-000000000114', 'interaction', 'rep', '10000000-0000-0000-0000-000000000005', 'note', 'internal', 'Entered yesterday’s visit after Karen’s nudge; I confirmed it by phone the evening before.', now() - interval '9 days' - interval '22 hours'),
  ('40000000-0000-0000-0000-000000000209', '30000000-0000-0000-0000-000000000114', 'interaction', 'system', null, 'note', 'internal', 'Omar Haddad (F&I) requested proof of income; no finance decision can proceed until it arrives.', now() - interval '9 days' - interval '21 hours'),
  ('40000000-0000-0000-0000-000000000210', '30000000-0000-0000-0000-000000000114', 'interaction', 'ai', null, 'email', 'outbound', '[Simulated] Omar is still waiting for the income document. Is there anything we can clarify about what to send?', now() - interval '7 days'),
  ('40000000-0000-0000-0000-000000000211', '30000000-0000-0000-0000-000000000114', 'interaction', 'ai', null, 'email', 'outbound', '[Simulated] A week has passed since the document request. Please reply when you know when you can send it.', now() - interval '2 days' - interval '21 hours'),
  ('40000000-0000-0000-0000-000000000212', '30000000-0000-0000-0000-000000000114', 'interaction', 'buyer', null, 'email', 'inbound', 'My payroll office has not sent it yet. I will forward it when they do.', now() - interval '2 days'),
  ('40000000-0000-0000-0000-000000000213', '30000000-0000-0000-0000-000000000114', 'transfer', 'gm', '10000000-0000-0000-0000-000000000001', 'note', 'internal', 'Transferred Maren from part-time Tom to Sofia; moved the outstanding income-document task to Sofia.', now() - interval '1 days' - interval '23 hours')
on conflict (id) do nothing;

-- H.1: After a visit and trade appraisal, Nikhil finds the payment too high, receives a pushy AI reply and buys elsewhere.
insert into public.timeline_events (id, deal_id, event_type, actor_type, actor_id, channel, direction, body, created_at) values
  ('40000000-0000-0000-0000-000000000214', '30000000-0000-0000-0000-000000000115', 'interaction', 'buyer', null, 'in_person', 'inbound', 'Here for the Santa Fe test drive. I brought my Civic because I may trade it in.', now() - interval '9 days'),
  ('40000000-0000-0000-0000-000000000215', '30000000-0000-0000-0000-000000000115', 'interaction', 'rep', '10000000-0000-0000-0000-000000000002', 'note', 'internal', 'Completed the visit and Civic appraisal; discussed the written payment options after confirming the visit yesterday.', now() - interval '8 days' - interval '23 hours'),
  ('40000000-0000-0000-0000-000000000216', '30000000-0000-0000-0000-000000000115', 'interaction', 'buyer', null, 'sms', 'inbound', 'The payment was too high.', now() - interval '8 days' - interval '22 hours'),
  ('40000000-0000-0000-0000-000000000217', '30000000-0000-0000-0000-000000000115', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] You would be crazy to pass this up. A sensible buyer would sign today.', now() - interval '8 days' - interval '21 hours' - interval '59 minutes'),
  ('40000000-0000-0000-0000-000000000218', '30000000-0000-0000-0000-000000000115', 'interaction', 'buyer', null, 'sms', 'inbound', 'I bought from another dealer. Their payments fit my budget.', now() - interval '8 days'),
  ('40000000-0000-0000-0000-000000000219', '30000000-0000-0000-0000-000000000115', 'interaction', 'rep', '10000000-0000-0000-0000-000000000002', 'note', 'internal', 'Buyer purchased elsewhere after the trade appraisal and payment discussion. Closed as lost.', now() - interval '7 days' - interval '23 hours')
on conflict (id) do nothing;

-- H.2: Olivia’s trade appraisal leaves the payment too high; Karen transfers Tom’s follow-up to Arjun while the buyer considers another dealer.
insert into public.timeline_events (id, deal_id, event_type, actor_type, actor_id, channel, direction, body, created_at) values
  ('40000000-0000-0000-0000-000000000220', '30000000-0000-0000-0000-000000000116', 'interaction', 'buyer', null, 'in_person', 'inbound', 'Here for the NX test drive. I brought the Cruze I mentioned trading in.', now() - interval '4 days'),
  ('40000000-0000-0000-0000-000000000221', '30000000-0000-0000-0000-000000000116', 'interaction', 'rep', '10000000-0000-0000-0000-000000000005', 'note', 'internal', 'Hosted the visit I confirmed yesterday; appraised the Cruze and reviewed the written payment schedule.', now() - interval '3 days' - interval '23 hours'),
  ('40000000-0000-0000-0000-000000000222', '30000000-0000-0000-0000-000000000116', 'interaction', 'buyer', null, 'sms', 'inbound', 'The payment was too high. I''ll talk to my wife first. We are comparing another dealer’s offer.', now() - interval '3 days' - interval '22 hours'),
  ('40000000-0000-0000-0000-000000000223', '30000000-0000-0000-0000-000000000116', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] Hurry back if you left anything in the car! Take your time with the decision.', now() - interval '3 days' - interval '21 hours' - interval '59 minutes'),
  ('40000000-0000-0000-0000-000000000224', '30000000-0000-0000-0000-000000000116', 'transfer', 'gm', '10000000-0000-0000-0000-000000000001', 'note', 'internal', 'Transferred Olivia from part-time Tom to Arjun and moved the pending payment-options question to Arjun.', now() - interval '3 days')
on conflict (id) do nothing;

-- I.1: Parker opts out by SMS but receives both an AI text and a staff email; a second deal also contains later prohibited contact.
insert into public.timeline_events (id, deal_id, event_type, actor_type, actor_id, channel, direction, body, created_at) values
  ('40000000-0000-0000-0000-000000000225', '30000000-0000-0000-0000-000000000117', 'interaction', 'buyer', null, 'sms', 'inbound', 'I was looking at the CR-V but have not made up my mind.', now() - interval '6 days'),
  ('40000000-0000-0000-0000-000000000226', '30000000-0000-0000-0000-000000000117', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] Take your time. Let us know if there is anything you want to check.', now() - interval '5 days' - interval '23 hours' - interval '59 minutes'),
  ('40000000-0000-0000-0000-000000000227', '30000000-0000-0000-0000-000000000117', 'opt_out', 'buyer', null, 'sms', 'inbound', 'Stop. No more messages on any channel.', now() - interval '5 days'),
  ('40000000-0000-0000-0000-000000000228', '30000000-0000-0000-0000-000000000117', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] Just checking whether you still wanted to see the CR-V.', now() - interval '4 days' - interval '23 hours' - interval '59 minutes'),
  ('40000000-0000-0000-0000-000000000229', '30000000-0000-0000-0000-000000000117', 'interaction', 'rep', '10000000-0000-0000-0000-000000000004', 'email', 'outbound', '[Simulated] Are you still interested in the CR-V? I can help with next steps.', now() - interval '4 days')
on conflict (id) do nothing;

-- I.2: Quinn opts out by email; a later AI SMS and Tom’s call both violate the buyer’s request.
insert into public.timeline_events (id, deal_id, event_type, actor_type, actor_id, channel, direction, body, created_at) values
  ('40000000-0000-0000-0000-000000000230', '30000000-0000-0000-0000-000000000118', 'interaction', 'buyer', null, 'email', 'inbound', 'I am considering the Crosstrek but only browsing today.', now() - interval '5 days'),
  ('40000000-0000-0000-0000-000000000231', '30000000-0000-0000-0000-000000000118', 'interaction', 'ai', null, 'email', 'outbound', '[Simulated] That is fine. Reply when you would like some more information.', now() - interval '4 days' - interval '23 hours' - interval '59 minutes'),
  ('40000000-0000-0000-0000-000000000232', '30000000-0000-0000-0000-000000000118', 'opt_out', 'buyer', null, 'email', 'inbound', 'Please stop contacting me.', now() - interval '4 days'),
  ('40000000-0000-0000-0000-000000000233', '30000000-0000-0000-0000-000000000118', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] Are you ready to take another look at the Crosstrek?', now() - interval '3 days' - interval '23 hours' - interval '58 minutes'),
  ('40000000-0000-0000-0000-000000000234', '30000000-0000-0000-0000-000000000118', 'interaction', 'rep', '10000000-0000-0000-0000-000000000005', 'call', 'outbound', 'Called Quinn about the Crosstrek; left a voicemail inviting another conversation.', now() - interval '3 days')
on conflict (id) do nothing;

-- I.3: Parker’s older Camry enquiry shares the CR-V buyer record; its pre-opt-out AI message is allowed but a later staff email is prohibited.
insert into public.timeline_events (id, deal_id, event_type, actor_type, actor_id, channel, direction, body, created_at) values
  ('40000000-0000-0000-0000-000000000235', '30000000-0000-0000-0000-000000000119', 'interaction', 'buyer', null, 'web', 'inbound', 'I am comparing the Camry with a CR-V as well.', now() - interval '7 days'),
  ('40000000-0000-0000-0000-000000000236', '30000000-0000-0000-0000-000000000119', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] We can keep both enquiries together so you do not have to repeat yourself.', now() - interval '6 days' - interval '23 hours' - interval '59 minutes'),
  ('40000000-0000-0000-0000-000000000237', '30000000-0000-0000-0000-000000000119', 'interaction', 'rep', '10000000-0000-0000-0000-000000000003', 'email', 'outbound', '[Simulated] Following up on the Camry you were comparing with the CR-V.', now() - interval '3 days')
on conflict (id) do nothing;

-- J.1: The AI treats Rhea’s requested visit as certain and invents a payment; Arjun later confirms a replacement visit and completes the sale.
insert into public.timeline_events (id, deal_id, event_type, actor_type, actor_id, channel, direction, body, created_at) values
  ('40000000-0000-0000-0000-000000000238', '30000000-0000-0000-0000-000000000120', 'interaction', 'buyer', null, 'sms', 'inbound', 'Could I come in tomorrow morning for the RDX?', now() - interval '8 days'),
  ('40000000-0000-0000-0000-000000000239', '30000000-0000-0000-0000-000000000120', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] Tomorrow morning works, see you then!', now() - interval '7 days' - interval '23 hours' - interval '59 minutes'),
  ('40000000-0000-0000-0000-000000000240', '30000000-0000-0000-0000-000000000120', 'interaction', 'buyer', null, 'sms', 'inbound', 'Ballpark on the monthly payment?', now() - interval '7 days' - interval '23 hours' - interval '57 minutes'),
  ('40000000-0000-0000-0000-000000000241', '30000000-0000-0000-0000-000000000120', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] You would be around five hundred a month.', now() - interval '7 days' - interval '23 hours' - interval '56 minutes'),
  ('40000000-0000-0000-0000-000000000242', '30000000-0000-0000-0000-000000000120', 'interaction', 'rep', '10000000-0000-0000-0000-000000000003', 'sms', 'outbound', '[Simulated] I am sorry for the mix-up. I have now confirmed a visit for the following afternoon.', now() - interval '7 days' - interval '23 hours'),
  ('40000000-0000-0000-0000-000000000243', '30000000-0000-0000-0000-000000000120', 'interaction', 'system', null, 'note', 'internal', 'Grace Kim (delivery) recorded the RDX handover after Arjun’s person-confirmed replacement visit.', now() - interval '4 days')
on conflict (id) do nothing;

-- J.2: The AI calls Samir’s requested visit settled; Sofia handles his human request, corrects the error and confirms an upcoming replacement.
insert into public.timeline_events (id, deal_id, event_type, actor_type, actor_id, channel, direction, body, created_at) values
  ('40000000-0000-0000-0000-000000000244', '30000000-0000-0000-0000-000000000121', 'interaction', 'buyer', null, 'sms', 'inbound', 'Can I come next week to see the XC40?', now() - interval '2 days'),
  ('40000000-0000-0000-0000-000000000245', '30000000-0000-0000-0000-000000000121', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] You''re all set. We will see you next week.', now() - interval '1 days' - interval '23 hours' - interval '59 minutes'),
  ('40000000-0000-0000-0000-000000000246', '30000000-0000-0000-0000-000000000121', 'interaction', 'buyer', null, 'sms', 'inbound', 'I would rather deal with a salesperson before making plans.', now() - interval '1 days' - interval '23 hours' - interval '57 minutes'),
  ('40000000-0000-0000-0000-000000000247', '30000000-0000-0000-0000-000000000121', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] I have asked Sofia to help with your plans.', now() - interval '1 days' - interval '23 hours' - interval '56 minutes'),
  ('40000000-0000-0000-0000-000000000248', '30000000-0000-0000-0000-000000000121', 'interaction', 'rep', '10000000-0000-0000-0000-000000000004', 'sms', 'outbound', '[Simulated] I am Sofia, your salesperson. The earlier message was premature; I have now confirmed a visit for next week.', now() - interval '1 days' - interval '23 hours'),
  ('40000000-0000-0000-0000-000000000249', '30000000-0000-0000-0000-000000000121', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] Sofia has confirmed your replacement visit. See you then!', now() - interval '1 days' - interval '22 hours' - interval '59 minutes')
on conflict (id) do nothing;

-- K.1: The AI guarantees a truck sold the day before; Dana explains, and Tessa declines the alternatives.
insert into public.timeline_events (id, deal_id, event_type, actor_type, actor_id, channel, direction, body, created_at) values
  ('40000000-0000-0000-0000-000000000250', '30000000-0000-0000-0000-000000000122', 'interaction', 'system', null, 'note', 'internal', 'Grace Kim (delivery) recorded the F-150 handover to its prior customer; the public listing has not been removed yet.', now() - interval '8 days'),
  ('40000000-0000-0000-0000-000000000251', '30000000-0000-0000-0000-000000000122', 'interaction', 'buyer', null, 'web', 'inbound', 'Is the white F-150 from the website still there?', now() - interval '7 days'),
  ('40000000-0000-0000-0000-000000000252', '30000000-0000-0000-0000-000000000122', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] It is sitting on our lot waiting for you.', now() - interval '6 days' - interval '23 hours' - interval '59 minutes'),
  ('40000000-0000-0000-0000-000000000253', '30000000-0000-0000-0000-000000000122', 'interaction', 'rep', '10000000-0000-0000-0000-000000000002', 'call', 'outbound', 'Called Tessa: the listed F-150 sold yesterday. Apologized and offered to check other trucks.', now() - interval '6 days' - interval '23 hours'),
  ('40000000-0000-0000-0000-000000000254', '30000000-0000-0000-0000-000000000122', 'interaction', 'buyer', null, 'sms', 'inbound', 'That was the only one I wanted. Please close this enquiry.', now() - interval '6 days' - interval '22 hours'),
  ('40000000-0000-0000-0000-000000000255', '30000000-0000-0000-0000-000000000122', 'interaction', 'system', null, 'note', 'internal', 'Buyer declined alternatives. Closed as lost: no matching car.', now() - interval '6 days' - interval '21 hours')
on conflict (id) do nothing;

-- K.2: The AI guarantees a sold Ram, then ignores Uri’s human and pricing requests without any later human event or task; the enquiry remains unresolved.
insert into public.timeline_events (id, deal_id, event_type, actor_type, actor_id, channel, direction, body, created_at) values
  ('40000000-0000-0000-0000-000000000256', '30000000-0000-0000-0000-000000000123', 'interaction', 'system', null, 'note', 'internal', 'Grace Kim (delivery) recorded the Ram handover to its previous buyer; the listing feed is still stale.', now() - interval '3 days'),
  ('40000000-0000-0000-0000-000000000257', '30000000-0000-0000-0000-000000000123', 'interaction', 'buyer', null, 'web', 'inbound', 'Is that black Ram actually there?', now() - interval '2 days'),
  ('40000000-0000-0000-0000-000000000258', '30000000-0000-0000-0000-000000000123', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] Yes, that Ram is available for you to view.', now() - interval '1 days' - interval '23 hours' - interval '59 minutes'),
  ('40000000-0000-0000-0000-000000000259', '30000000-0000-0000-0000-000000000123', 'interaction', 'buyer', null, 'sms', 'inbound', 'can I get a human, and hw much would the Ram be', now() - interval '1 days' - interval '23 hours' - interval '57 minutes'),
  ('40000000-0000-0000-0000-000000000260', '30000000-0000-0000-0000-000000000123', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] You would be around six hundred a month. You would be crazy to miss it.', now() - interval '1 days' - interval '23 hours' - interval '56 minutes'),
  ('40000000-0000-0000-0000-000000000261', '30000000-0000-0000-0000-000000000123', 'interaction', 'buyer', null, 'sms', 'inbound', 'Please put me through to Tom instead.', now() - interval '1 days' - interval '23 hours' - interval '55 minutes'),
  ('40000000-0000-0000-0000-000000000262', '30000000-0000-0000-0000-000000000123', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] Let me check whether it is still available.', now() - interval '1 days' - interval '23 hours' - interval '54 minutes')
on conflict (id) do nothing;

-- L.1: With email AI off and no owner, Vera waits two days, tries SMS and receives robotic non-answers instead of a human or quote.
insert into public.timeline_events (id, deal_id, event_type, actor_type, actor_id, channel, direction, body, created_at) values
  ('40000000-0000-0000-0000-000000000263', '30000000-0000-0000-0000-000000000124', 'interaction', 'buyer', null, 'email', 'inbound', 'Please email a complete Sentra quote and have someone call me.', now() - interval '6 days'),
  ('40000000-0000-0000-0000-000000000264', '30000000-0000-0000-0000-000000000124', 'interaction', 'system', null, 'note', 'internal', 'AI is off for email. No owner has been assigned and the inbox message remains unanswered.', now() - interval '5 days' - interval '23 hours' - interval '59 minutes'),
  ('40000000-0000-0000-0000-000000000265', '30000000-0000-0000-0000-000000000124', 'interaction', 'buyer', null, 'sms', 'inbound', 'Two days with no email back. Is there someone I can call? What are you asking for the Sentra?', now() - interval '4 days'),
  ('40000000-0000-0000-0000-000000000266', '30000000-0000-0000-0000-000000000124', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] Your inquiry has been received. Reference number 8826.', now() - interval '3 days' - interval '23 hours' - interval '59 minutes'),
  ('40000000-0000-0000-0000-000000000267', '30000000-0000-0000-0000-000000000124', 'interaction', 'buyer', null, 'email', 'inbound', 'I could not reach anyone who could help, so I have moved on.', now() - interval '3 days'),
  ('40000000-0000-0000-0000-000000000268', '30000000-0000-0000-0000-000000000124', 'interaction', 'system', null, 'note', 'internal', 'Inbox enquiry closed as lost: could not reach. No rep was ever assigned.', now() - interval '2 days' - interval '23 hours')
on conflict (id) do nothing;

-- L.2: Wes’s email stays unanswered with email AI off; a later missed-call text invents a price and promises a person without recording any handoff.
insert into public.timeline_events (id, deal_id, event_type, actor_type, actor_id, channel, direction, body, created_at) values
  ('40000000-0000-0000-0000-000000000269', '30000000-0000-0000-0000-000000000125', 'interaction', 'buyer', null, 'email', 'inbound', 'Could someone send a quote for the Encore GX?', now() - interval '3 days'),
  ('40000000-0000-0000-0000-000000000270', '30000000-0000-0000-0000-000000000125', 'interaction', 'system', null, 'note', 'internal', 'Email AI is disabled. The new Encore GX enquiry remains unassigned in the shared inbox.', now() - interval '2 days' - interval '23 hours' - interval '59 minutes'),
  ('40000000-0000-0000-0000-000000000271', '30000000-0000-0000-0000-000000000125', 'interaction', 'buyer', null, 'call', 'inbound', 'Missed call after two days without an email reply; voicemail: I would rather deal with a salesperson.', now() - interval '1 days'),
  ('40000000-0000-0000-0000-000000000272', '30000000-0000-0000-0000-000000000125', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] The total would be twenty eight thousand including tax; someone can help you later.', now() - interval '23 hours' - interval '59 minutes' - interval '20 seconds'),
  ('40000000-0000-0000-0000-000000000273', '30000000-0000-0000-0000-000000000125', 'interaction', 'buyer', null, 'sms', 'inbound', 'Can I get a human to explain those numbers?', now() - interval '23 hours'),
  ('40000000-0000-0000-0000-000000000274', '30000000-0000-0000-0000-000000000125', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] Someone will get in touch.', now() - interval '22 hours' - interval '59 minutes')
on conflict (id) do nothing;

-- M.1: A fictional SEO vendor emails the store; Leah identifies the spam and closes it without AI contact.
insert into public.timeline_events (id, deal_id, event_type, actor_type, actor_id, channel, direction, body, created_at) values
  ('40000000-0000-0000-0000-000000000275', '30000000-0000-0000-0000-000000000126', 'interaction', 'buyer', null, 'email', 'inbound', 'We sell search engine optimization packages for dealership websites. Who handles your marketing?', now() - interval '4 days'),
  ('40000000-0000-0000-0000-000000000276', '30000000-0000-0000-0000-000000000126', 'interaction', 'system', null, 'note', 'internal', 'Leah Morgan (BDC) identified unsolicited SEO services spam, not a vehicle enquiry; closed as lost: not a buyer.', now() - interval '3 days' - interval '23 hours' - interval '59 minutes')
on conflict (id) do nothing;

-- M.2: An SEO vendor receives an inappropriate canned AI auto-reply before Leah classifies the message as not a buyer.
insert into public.timeline_events (id, deal_id, event_type, actor_type, actor_id, channel, direction, body, created_at) values
  ('40000000-0000-0000-0000-000000000277', '30000000-0000-0000-0000-000000000127', 'interaction', 'buyer', null, 'email', 'inbound', 'Offering an SEO audit for Northgate Motors. This is a vendor promotion, not a car enquiry.', now() - interval '2 days'),
  ('40000000-0000-0000-0000-000000000278', '30000000-0000-0000-0000-000000000127', 'interaction', 'ai', null, 'email', 'outbound', '[Simulated] Your sales inquiry has been received. Reference number 6650.', now() - interval '1 days' - interval '23 hours' - interval '59 minutes' - interval '30 seconds'),
  ('40000000-0000-0000-0000-000000000279', '30000000-0000-0000-0000-000000000127', 'interaction', 'system', null, 'note', 'internal', 'Leah Morgan (BDC) marked the unsolicited SEO audit promotion lost: not a buyer; no sales follow-up needed.', now() - interval '1 days' - interval '23 hours' - interval '55 minutes')
on conflict (id) do nothing;

insert into public.appointments (id, deal_id, scheduled_for, status, confirmed_by, confirmed_at, outcome_note) values
  ('50000000-0000-0000-0000-000000000101', '30000000-0000-0000-0000-000000000101', now() - interval '12 days', 'completed', '10000000-0000-0000-0000-000000000002', now() - interval '13 days' - interval '15 hours', 'Dana hosted the test drive.'),
  ('50000000-0000-0000-0000-000000000102', '30000000-0000-0000-0000-000000000102', now() - interval '3 days', 'completed', '10000000-0000-0000-0000-000000000002', now() - interval '4 days' - interval '15 hours', 'Visited; financing paperwork in progress.'),
  ('50000000-0000-0000-0000-000000000103', '30000000-0000-0000-0000-000000000107', now() - interval '9 days', 'completed', '10000000-0000-0000-0000-000000000005', now() - interval '9 days' - interval '22 hours', 'Tom hosted the visit; sale completed afterwards.'),
  ('50000000-0000-0000-0000-000000000104', '30000000-0000-0000-0000-000000000108', now() - interval '2 days', 'completed', '10000000-0000-0000-0000-000000000003', now() - interval '2 days' - interval '22 hours', 'Arjun hosted the visit; Callum is still considering the Civic.'),
  ('50000000-0000-0000-0000-000000000105', '30000000-0000-0000-0000-000000000109', now() - interval '10 days', 'no_show', '10000000-0000-0000-0000-000000000002', now() - interval '10 days' - interval '23 hours', 'Dana confirmed; Dylan did not attend.'),
  ('50000000-0000-0000-0000-000000000106', '30000000-0000-0000-0000-000000000109', now() - interval '7 days', 'completed', '10000000-0000-0000-0000-000000000002', now() - interval '8 days', 'Replacement visit attended.'),
  ('50000000-0000-0000-0000-000000000107', '30000000-0000-0000-0000-000000000110', now() - interval '4 days', 'no_show', '10000000-0000-0000-0000-000000000004', now() - interval '4 days' - interval '23 hours', 'Sofia confirmed; buyer did not arrive.'),
  ('50000000-0000-0000-0000-000000000108', '30000000-0000-0000-0000-000000000110', now() + interval '3 days', 'confirmed', '10000000-0000-0000-0000-000000000004', now() - interval '1 days' - interval '23 hours', 'Upcoming replacement visit.'),
  ('50000000-0000-0000-0000-000000000109', '30000000-0000-0000-0000-000000000111', now() - interval '6 days', 'completed', '10000000-0000-0000-0000-000000000002', now() - interval '6 days' - interval '22 hours', 'Buyer returned after the day-45 check-in.'),
  ('50000000-0000-0000-0000-000000000110', '30000000-0000-0000-0000-000000000113', now() - interval '19 days', 'completed', '10000000-0000-0000-0000-000000000003', now() - interval '20 days', 'Original confirmation and attended visit were imported after Karen’s nudge.'),
  ('50000000-0000-0000-0000-000000000111', '30000000-0000-0000-0000-000000000114', now() - interval '11 days', 'completed', '10000000-0000-0000-0000-000000000005', now() - interval '12 days', 'Person-confirmed visit imported after Karen’s nudge.'),
  ('50000000-0000-0000-0000-000000000112', '30000000-0000-0000-0000-000000000115', now() - interval '8 days' - interval '23 hours', 'completed', '10000000-0000-0000-0000-000000000002', now() - interval '10 days', 'Visited and received a trade appraisal.'),
  ('50000000-0000-0000-0000-000000000113', '30000000-0000-0000-0000-000000000116', now() - interval '3 days' - interval '23 hours', 'completed', '10000000-0000-0000-0000-000000000005', now() - interval '5 days', 'Trade appraisal and payment discussion completed.'),
  ('50000000-0000-0000-0000-000000000114', '30000000-0000-0000-0000-000000000120', now() - interval '7 days', 'cancelled', null, null, 'Original request withdrawn; nobody confirmed it.'),
  ('50000000-0000-0000-0000-000000000115', '30000000-0000-0000-0000-000000000120', now() - interval '6 days', 'completed', '10000000-0000-0000-0000-000000000003', now() - interval '7 days' - interval '23 hours', 'Replacement visit confirmed by Arjun and attended.'),
  ('50000000-0000-0000-0000-000000000116', '30000000-0000-0000-0000-000000000121', now() + interval '4 days', 'cancelled', null, null, 'Original unconfirmed request replaced.'),
  ('50000000-0000-0000-0000-000000000117', '30000000-0000-0000-0000-000000000121', now() + interval '5 days', 'confirmed', '10000000-0000-0000-0000-000000000004', now() - interval '1 days' - interval '23 hours', 'Upcoming visit personally confirmed by Sofia.')
on conflict (id) do nothing;

insert into public.open_items (id, deal_id, owner_id, type, description, status, due_at, created_at, resolved_at) values
  ('60000000-0000-0000-0000-000000000101', '30000000-0000-0000-0000-000000000101', '10000000-0000-0000-0000-000000000002', 'missing_doc', 'Send Omar proof of insurance for the RAV4.', 'resolved', now() - interval '11 days', now() - interval '11 days' - interval '23 hours', now() - interval '11 days'),
  ('60000000-0000-0000-0000-000000000102', '30000000-0000-0000-0000-000000000102', '10000000-0000-0000-0000-000000000002', 'missing_doc', 'Miles to send proof of insurance to Omar.', 'open', now() - interval '2 days', now() - interval '2 days' - interval '23 hours', null),
  ('60000000-0000-0000-0000-000000000103', '30000000-0000-0000-0000-000000000105', '10000000-0000-0000-0000-000000000003', 'unanswered_question', 'Arjun to email the complete itemized Golf quote.', 'resolved', now() - interval '11 days' - interval '22 hours', now() - interval '11 days' - interval '23 hours' - interval '50 minutes', now() - interval '11 days' - interval '23 hours'),
  ('60000000-0000-0000-0000-000000000104', '30000000-0000-0000-0000-000000000106', '10000000-0000-0000-0000-000000000004', 'unanswered_question', 'Sofia to email the Elantra total and fee breakdown.', 'resolved', now() - interval '6 days' - interval '21 hours', now() - interval '6 days' - interval '23 hours' - interval '55 minutes', now() - interval '6 days' - interval '22 hours'),
  ('60000000-0000-0000-0000-000000000105', '30000000-0000-0000-0000-000000000107', '10000000-0000-0000-0000-000000000005', 'callback', 'Return Aisha’s request for Sofia; transferred from Sofia to Tom.', 'resolved', now() - interval '9 days' - interval '22 hours', now() - interval '9 days' - interval '23 hours' - interval '57 minutes', now() - interval '9 days' - interval '22 hours'),
  ('60000000-0000-0000-0000-000000000106', '30000000-0000-0000-0000-000000000108', '10000000-0000-0000-0000-000000000003', 'callback', 'Call Callum after work; transferred from Dana to Arjun.', 'resolved', now() - interval '2 days' - interval '21 hours', now() - interval '2 days' - interval '23 hours' - interval '58 minutes', now() - interval '2 days' - interval '20 hours'),
  ('60000000-0000-0000-0000-000000000107', '30000000-0000-0000-0000-000000000112', '10000000-0000-0000-0000-000000000004', 'callback', 'Arrange Keira’s return conversation; moved from Tom to Sofia.', 'open', now() - interval '2 days', now() - interval '2 days' - interval '23 hours', null),
  ('60000000-0000-0000-0000-000000000108', '30000000-0000-0000-0000-000000000113', '10000000-0000-0000-0000-000000000003', 'missing_doc', 'Provide Omar with proof of income for the Sportage finance application.', 'resolved', now() - interval '17 days', now() - interval '17 days' - interval '21 hours', now() - interval '10 days'),
  ('60000000-0000-0000-0000-000000000109', '30000000-0000-0000-0000-000000000114', '10000000-0000-0000-0000-000000000004', 'missing_doc', 'Send Omar proof of income; outstanding task transferred from Tom to Sofia.', 'open', now() - interval '9 days', now() - interval '9 days' - interval '21 hours', null),
  ('60000000-0000-0000-0000-000000000110', '30000000-0000-0000-0000-000000000116', '10000000-0000-0000-0000-000000000003', 'unanswered_question', 'Discuss alternatives to the NX payment; task transferred from Tom to Arjun.', 'open', now() - interval '2 days', now() - interval '3 days' - interval '22 hours', null)
on conflict (id) do nothing;


-- F.3/F.4: enquiries that remain dormant at the current snapshot.
-- No new appointment is needed; ...118 remains the next appointment ID.
insert into public.buyers (id, name, email, phone, preferred_channel, opted_out, created_at) values
  ('20000000-0000-0000-0000-000000000127', 'Yvonne Carter', 'yvonne.carter@example.com', '416-555-0137', 'email', false, now() - interval '26 days'),
  ('20000000-0000-0000-0000-000000000128', 'Zane Mercer', 'zane.mercer@example.com', '416-555-0138', 'sms', false, now() - interval '44 days')
on conflict (id) do nothing;

insert into public.deals (id, buyer_id, owner_id, vehicle_interest, source, stage, lost_reason, created_at) values
  ('30000000-0000-0000-0000-000000000128', '20000000-0000-0000-0000-000000000127', '10000000-0000-0000-0000-000000000004', '2020 Mazda3 GS', 'email', 'dormant', null, now() - interval '26 days'),
  ('30000000-0000-0000-0000-000000000129', '20000000-0000-0000-0000-000000000128', '10000000-0000-0000-0000-000000000005', '2020 Honda Civic LX', 'website', 'dormant', null, now() - interval '44 days')
on conflict (id) do nothing;

-- F.3: 26 days without a buyer reply; the long-term check-in is not due.
insert into public.timeline_events (id, deal_id, event_type, actor_type, actor_id, channel, direction, body, created_at) values
  ('40000000-0000-0000-0000-000000000280', '30000000-0000-0000-0000-000000000128', 'interaction', 'buyer', null, 'email', 'inbound', 'Would you email a written cash quote for the Mazda3 GS?', now() - interval '26 days'),
  ('40000000-0000-0000-0000-000000000281', '30000000-0000-0000-0000-000000000128', 'assignment', 'gm', '10000000-0000-0000-0000-000000000001', 'note', 'internal', 'Assigned Yvonne to Sofia for the Mazda3 quotation.', now() - interval '26 days' + interval '5 minutes'),
  ('40000000-0000-0000-0000-000000000282', '30000000-0000-0000-0000-000000000128', 'interaction', 'rep', '10000000-0000-0000-0000-000000000004', 'email', 'outbound', '[Simulated] Your Mazda3 cash quote totals $22,240 with tax and licensing. Please see the attached itemized offer.', now() - interval '26 days' + interval '1 hour'),
  ('40000000-0000-0000-0000-000000000283', '30000000-0000-0000-0000-000000000128', 'interaction', 'ai', null, 'email', 'outbound', '[Simulated] Was the Mazda3 offer easy to open? Sofia can explain the breakdown if needed.', now() - interval '23 days'),
  ('40000000-0000-0000-0000-000000000284', '30000000-0000-0000-0000-000000000128', 'interaction', 'ai', null, 'email', 'outbound', '[Simulated] Leaving the Mazda3 paperwork with you for now. You can pick up the conversation when your plans are clearer.', now() - interval '19 days'),
  ('40000000-0000-0000-0000-000000000285', '30000000-0000-0000-0000-000000000128', 'interaction', 'system', null, 'note', 'internal', 'Neither follow-up received a reply. Marked dormant; the day-45 check-in window has not arrived and no follow-up is currently due.', now() - interval '12 days')
on conflict (id) do nothing;

-- F.4: 44 days without a buyer reply; Tom has a check-in due tomorrow.
insert into public.timeline_events (id, deal_id, event_type, actor_type, actor_id, channel, direction, body, created_at) values
  ('40000000-0000-0000-0000-000000000286', '30000000-0000-0000-0000-000000000129', 'interaction', 'buyer', null, 'web', 'inbound', 'Please work out payment options for the Civic LX and text me the details.', now() - interval '44 days'),
  ('40000000-0000-0000-0000-000000000287', '30000000-0000-0000-0000-000000000129', 'assignment', 'gm', '10000000-0000-0000-0000-000000000001', 'note', 'internal', 'Assigned Zane to Tom for the Civic enquiry.', now() - interval '44 days' + interval '3 minutes'),
  ('40000000-0000-0000-0000-000000000288', '30000000-0000-0000-0000-000000000129', 'interaction', 'rep', '10000000-0000-0000-0000-000000000005', 'sms', 'outbound', '[Simulated] I have emailed the Civic offer and finance illustrations. The cash total is $23,170 including tax and licensing.', now() - interval '44 days' + interval '1 hour'),
  ('40000000-0000-0000-0000-000000000289', '30000000-0000-0000-0000-000000000129', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] Choose the Civic and your payment will be three hundred and eighty a month.', now() - interval '41 days'),
  ('40000000-0000-0000-0000-000000000290', '30000000-0000-0000-0000-000000000129', 'interaction', 'ai', null, 'sms', 'outbound', '[Simulated] If your search is on pause, that is okay. Tom can revisit the paperwork whenever you are ready.', now() - interval '37 days'),
  ('40000000-0000-0000-0000-000000000291', '30000000-0000-0000-0000-000000000129', 'interaction', 'system', null, 'note', 'internal', 'Two follow-ups went unanswered. Marked dormant and recorded Tom’s long-term callback for day 45 after Zane’s last message.', now() - interval '30 days')
on conflict (id) do nothing;

insert into public.open_items (id, deal_id, owner_id, type, description, status, due_at, created_at, resolved_at) values
  ('60000000-0000-0000-0000-000000000111', '30000000-0000-0000-0000-000000000129', '10000000-0000-0000-0000-000000000005', 'callback', 'Tom to check whether Zane wants to resume the Civic enquiry at the day-45 point.', 'open', now() + interval '1 day', now() - interval '30 days', null)
on conflict (id) do nothing;

commit;
