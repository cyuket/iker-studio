-- Puts Tunde Adeyemi's demo booking back to "Awaiting confirmation" with its ₦15,000 deposit
-- pending review, so the "Confirm booking" (or "Reject payment") take can be recorded again.
--
-- LOCAL ONLY. Run it through `fixtures/iker-demo/seed.sh reset-tunde`, which refuses any database
-- that is not on 127.0.0.1 / localhost.
--
-- Iker's database deliberately refuses to un-confirm money (payment_immutability,
-- booking_money_freeze, booking status freeze). This script therefore switches triggers off for
-- its own transaction only (session_replication_role = replica, which needs the local postgres
-- superuser) and touches exactly two rows: Tunde's booking and Tunde's payment, by fixed id. It
-- also moves the booking to the working day after tomorrow at 10:00 WAT (same rule as seed.sql),
-- so the take always shows an upcoming booking. Audit and email-log rows a previous take wrote are
-- left in place. Never run this kind of script against a real business.

\set ON_ERROR_STOP on

begin;

set local session_replication_role = replica;

create or replace function pg_temp.iker_demo_workday(n int) returns date
language plpgsql as $$
declare
  d date := (now() at time zone 'Africa/Lagos')::date;
  remaining int := n;
begin
  while extract(dow from d) = 0 loop d := d + 1; end loop;
  while remaining > 0 loop
    d := d + 1;
    if extract(dow from d) <> 0 then remaining := remaining - 1; end if;
  end loop;
  return d;
end $$;

update booking
set status = 'awaiting_confirmation',
    cancellation_reason = null,
    cancelled_by = null,
    cancelled_at = null,
    start_at = (pg_temp.iker_demo_workday(2) + time '10:00') at time zone 'Africa/Lagos',
    end_at = (pg_temp.iker_demo_workday(2) + time '11:30') at time zone 'Africa/Lagos',
    updated_at = now()
where id = '7a3e0000-0000-4000-a000-000000000041'
  and business_id = '7a3e0000-0000-4000-a000-000000000002';

update payment
set status = 'pending_review',
    confirmed_at = null,
    confirmed_by_staff_id = null
where id = '7a3e0000-0000-4000-a000-000000000051'
  and booking_id = '7a3e0000-0000-4000-a000-000000000041';

-- Any extra payment a take recorded on Tunde's booking (for example "Record a payment") would
-- keep "Paid so far" above zero; payments cannot be deleted, so report it instead of hiding it.
do $$
declare v_extra int;
begin
  select count(*) into v_extra from payment
  where booking_id = '7a3e0000-0000-4000-a000-000000000041'
    and id <> '7a3e0000-0000-4000-a000-000000000051';
  if v_extra > 0 then
    raise warning 'Tunde''s booking has % extra payment row(s) from an earlier take; they were left as they are.', v_extra;
  end if;
end $$;

commit;

select b.id as booking_id, b.status as booking_status,
       to_char(b.start_at at time zone 'Africa/Lagos', 'Dy DD Mon HH24:MI') as starts_wat,
       p.id as payment_id, p.status as payment_status, p.amount_kobo / 100 as amount_naira
from booking b join payment p on p.booking_id = b.id
where b.id = '7a3e0000-0000-4000-a000-000000000041';
