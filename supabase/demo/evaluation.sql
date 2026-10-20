-- Read-only inspection of stored evaluation results and manager reviews.
select b.name as buyer, e.result, f.flag_type, f.review_status,
  s.name as reviewed_by, f.review_note, t.body as evidence
from public.ai_evaluations e
join public.deals d on d.id = e.deal_id
join public.buyers b on b.id = d.buyer_id
left join public.ai_flags f on f.deal_id = e.deal_id
left join public.staff_users s on s.id = f.reviewed_by
left join public.timeline_events t on t.id = f.evidence_event_id
order by b.name, f.created_at, f.id;

-- The hosted integration check's evaluation and review history.
select created_at, event_type, actor_type, body
from public.timeline_events
where deal_id = '39000000-0000-0000-0000-000000000001'
order by created_at, id;
