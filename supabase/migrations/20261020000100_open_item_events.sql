-- Resolving or cancelling an open item (US4) is written to the shared timeline as
-- its own event type, so the follow-up and evaluation rules do not mistake this
-- bookkeeping for a person talking to the buyer. No new table: the item keeps its
-- status and resolved_at; the event records who closed it, when, and why.
begin;

alter table public.timeline_events drop constraint timeline_events_event_type_check;
alter table public.timeline_events add constraint timeline_events_event_type_check
  check (event_type in (
    'interaction', 'assignment', 'transfer', 'opt_out', 'ai_evaluation', 'ai_review', 'open_item'
  ));

commit;
