-- Confirms Chioma Okafor's ₦15,000 deposit on her Saturday bridal booking (the "now now" video)
-- through the product's own confirm path, so iker-amaka-chioma-confirmed-phone can record the
-- booking after confirming (Paid so far ₦15,000, Balance remaining ₦30,000) without the scenario
-- pressing Confirm booking itself. Real-product scenarios never press a button that saves.
--
-- LOCAL ONLY. Run it through `fixtures/iker-demo/seed.sh confirm-chioma`, which refuses any
-- database that is not on 127.0.0.1 / localhost. Undo it with `seed.sh reset-chioma`.
--
-- It calls confirm_pending_payment (what the "Confirm booking" button calls) as Amaka, the demo
-- owner, by setting the JWT claims auth.uid() reads for this transaction only. That writes the
-- same payment, booking and audit rows the button does; the app's booking emails are not sent.

\set ON_ERROR_STOP on

begin;

select set_config(
  'request.jwt.claims',
  '{"sub":"7a3e0000-0000-4000-a000-000000000003","role":"authenticated"}',
  true
) as _ignored \gset
\unset _ignored
set local role authenticated;

select confirm_pending_payment('7a3e0000-0000-4000-a000-000000000057');

commit;

select b.id as booking_id, b.status as booking_status,
       to_char(b.start_at at time zone 'Africa/Lagos', 'Dy DD Mon HH24:MI') as starts_wat,
       p.status as payment_status, p.amount_kobo / 100 as paid_naira,
       (b.price_kobo - p.amount_kobo) / 100 as balance_naira
from booking b join payment p on p.booking_id = b.id
where b.id = '7a3e0000-0000-4000-a000-000000000046';
