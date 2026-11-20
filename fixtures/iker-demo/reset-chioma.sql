-- Puts Chioma Okafor's Saturday bridal booking (the "now now" video) back to "Awaiting
-- confirmation" with its ₦15,000 deposit pending review, so the "Confirm booking" take can be
-- recorded again.
--
-- LOCAL ONLY. Run it through `fixtures/iker-demo/seed.sh reset-chioma`, which refuses any database
-- that is not on 127.0.0.1 / localhost.
--
-- Same approach as reset-tunde.sql: Iker's database refuses to un-confirm money, so triggers are
-- switched off for this transaction only (session_replication_role = replica, local postgres
-- superuser) and exactly two rows are touched by fixed id. The booking moves to the Saturday 7 to
-- 13 days ahead at 10:30 WAT (same rule as seed.sql). Audit and email-log rows a previous take
-- wrote are left in place. Never run this kind of script against a real business.

\set ON_ERROR_STOP on

begin;

set local session_replication_role = replica;

create or replace function pg_temp.iker_demo_saturday_at(t time) returns timestamptz
language sql as $$
  select (d + ((13 - extract(dow from d)::int) % 7) + t) at time zone 'Africa/Lagos'
  from (select (now() at time zone 'Africa/Lagos')::date + 7 as d) base
$$;

update booking
set status = 'awaiting_confirmation',
    cancellation_reason = null,
    cancelled_by = null,
    cancelled_at = null,
    start_at = pg_temp.iker_demo_saturday_at(time '10:30'),
    end_at = pg_temp.iker_demo_saturday_at(time '10:30') + interval '150 minutes',
    updated_at = now()
where id = '7a3e0000-0000-4000-a000-000000000046'
  and business_id = '7a3e0000-0000-4000-a000-000000000002';

update payment
set status = 'pending_review',
    confirmed_at = null,
    confirmed_by_staff_id = null
where id = '7a3e0000-0000-4000-a000-000000000057'
  and booking_id = '7a3e0000-0000-4000-a000-000000000046';

do $$
declare v_extra int;
begin
  select count(*) into v_extra from payment
  where booking_id = '7a3e0000-0000-4000-a000-000000000046'
    and id <> '7a3e0000-0000-4000-a000-000000000057';
  if v_extra > 0 then
    raise warning 'Chioma''s Saturday booking has % extra payment row(s) from an earlier take; they were left as they are.', v_extra;
  end if;
end $$;

commit;

select b.id as booking_id, b.status as booking_status,
       to_char(b.start_at at time zone 'Africa/Lagos', 'Dy DD Mon HH24:MI') as starts_wat,
       p.id as payment_id, p.status as payment_status, p.amount_kobo / 100 as amount_naira
from booking b join payment p on p.booking_id = b.id
where b.id = '7a3e0000-0000-4000-a000-000000000046';
