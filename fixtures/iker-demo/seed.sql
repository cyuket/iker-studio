-- Iker local demo data: "Amaka Studio", a fictional makeup artist in Abuja.
--
-- LOCAL ONLY. Run it through seed.sh, which refuses any database that is not on 127.0.0.1 /
-- localhost and exports the owner password from Iker-studio/.env (IKER_DEMO_PASSWORD); psql
-- reads it with \getenv so it never appears on a command line. Never point this at a hosted Supabase project: it writes
-- auth.users directly, the same way slot-books/supabase/seed.sql does for local dev.
--
-- Idempotent and additive: every row has a fixed id (prefix 7a3e0000-...) or hangs off the demo
-- business, inserts use ON CONFLICT DO NOTHING, and nothing that already existed is touched.
-- A re-run also:
--   * resets the owner's password to IKER_DEMO_PASSWORD;
--   * re-dates the demo bookings relative to today (Africa/Lagos), so the dashboard and calendar
--     always show a live week. Only start_at / end_at move; amounts and payments never change.
-- To put Tunde's booking back to "Awaiting confirmation" after a take, run reset-tunde.sql
-- (`fixtures/iker-demo/seed.sh reset-tunde`); for Chioma's Saturday booking, `seed.sh reset-chioma`.
--
-- Everything is fictional: example.com emails, +234800000xxxx phone numbers, "Example Bank",
-- account number 0123456789.

\set ON_ERROR_STOP on
\getenv owner_password IKER_DEMO_PASSWORD

begin;

-- \gset into a throwaway variable so the value is never printed.
select set_config('iker_demo.owner_password', :'owner_password', true) as _ignored \gset
\unset _ignored
\unset owner_password

-- n-th working day (Mon-Sat; the studio is closed on Sunday) from today in Lagos. n = 0 is today
-- if today is a working day, otherwise the next one; negative n counts backwards.
create or replace function pg_temp.iker_demo_workday(n int) returns date
language plpgsql as $$
declare
  d date := (now() at time zone 'Africa/Lagos')::date;
  step int := case when n < 0 then -1 else 1 end;
  remaining int := abs(n);
begin
  while extract(dow from d) = 0 loop d := d + 1; end loop;
  while remaining > 0 loop
    d := d + step;
    if extract(dow from d) <> 0 then remaining := remaining - 1; end if;
  end loop;
  return d;
end $$;

create or replace function pg_temp.iker_demo_at(n int, t time) returns timestamptz
language sql as $$ select (pg_temp.iker_demo_workday(n) + t) at time zone 'Africa/Lagos' $$;

-- The Saturday 7 to 13 days from today in Lagos, at time t. Far enough out to clear the
-- workday-offset bookings above and the day the client-books scenario picks (today + 5 or 6).
create or replace function pg_temp.iker_demo_saturday_at(t time) returns timestamptz
language sql as $$
  select (d + ((13 - extract(dow from d)::int) % 7) + t) at time zone 'Africa/Lagos'
  from (select (now() at time zone 'Africa/Lagos')::date + 7 as d) base
$$;

do $$
declare
  v_group    uuid := '7a3e0000-0000-4000-a000-000000000001';
  v_business uuid := '7a3e0000-0000-4000-a000-000000000002';
  v_owner    uuid := '7a3e0000-0000-4000-a000-000000000003';
  v_category uuid := '7a3e0000-0000-4000-a000-000000000010';
  v_softglam uuid := '7a3e0000-0000-4000-a000-000000000011';
  v_bridal   uuid := '7a3e0000-0000-4000-a000-000000000012';
  v_gele     uuid := '7a3e0000-0000-4000-a000-000000000013';
  v_email    text := 'amaka.owner@example.com';
  v_password text := current_setting('iker_demo.owner_password');
  v_plan     uuid;
begin
  if v_password is null or length(v_password) < 8 then
    raise exception 'owner_password is missing or shorter than 8 characters';
  end if;

  -- Owner account: email + password, email confirmed, no second factor.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, reauthentication_token,
    created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000', v_owner, 'authenticated', 'authenticated',
    v_email, crypt(v_password, gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb,
    '{"email_verified":true,"full_name":"Amaka Obi"}'::jsonb,
    '', '', '', '', '', '',
    now(), now()
  )
  on conflict (id) do update
    set encrypted_password = crypt(v_password, gen_salt('bf')), updated_at = now();

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    '7a3e0000-0000-4000-a000-000000000004', v_owner, v_owner::text,
    jsonb_build_object('sub', v_owner::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now()
  )
  on conflict (provider_id, provider) do nothing;

  -- Business group and its subscription first, so the business insert's starter-plan trigger
  -- (assign_starter_subscription, ON CONFLICT DO NOTHING) leaves this one alone. Team has no
  -- service or policy limit. Starter and Growth allow 1 service and Pro 3
  -- (slot-books supabase/migrations/0048_plan_feature_flags.sql), and this seed adds 3.
  insert into business_group (id, name, owner_id)
  values (v_group, 'Amaka Studio', null)
  on conflict (id) do nothing;

  select id into v_plan from plan where code = 'team';
  if v_plan is null then raise exception 'plan "team" not found'; end if;

  insert into subscription (
    business_group_id, plan_id, billing_cycle, status, price_locked_kobo,
    current_period_start, current_period_end
  ) values (
    v_group, v_plan, 'yearly', 'active', 0, now(), now() + interval '1 year'
  )
  on conflict (business_group_id) do nothing;

  insert into business (
    id, slug, name, category, contact_phone, contact_email, city, location,
    public_balance_info, status, activated_at, business_group_id, address_required
  ) values (
    v_business, 'amaka-studio', 'Amaka Studio', 'Makeup', '+2348000000010',
    'amaka.owner@example.com', 'Abuja', 'Wuse 2, Abuja',
    -- The exact shape lib/settings/schema.ts toPublicBalanceInfo() writes.
    '{"bank_name":"Example Bank","account_number":"0123456789","account_name":"Amaka Studio"}'::jsonb,
    'active', now(), v_group, true
  )
  on conflict (id) do nothing;

  -- staff_user.id is the auth user id. The owner row also sets business_group.owner_id
  -- (business_group_owner_sync).
  insert into staff_user (id, business_id, role, full_name, email, phone, is_active)
  values (v_owner, v_business, 'owner', 'Amaka Obi', v_email, '+2348000000010', true)
  on conflict (id, business_id) do nothing;

  -- Address (setup checklist: "Set your address & contact phone"). Fictional place id; shown to
  -- clients by area only.
  insert into business_address (business_id, formatted_address, place_id, lat, lng, area, city, state, visibility)
  values (v_business, '12 Example Close, Wuse 2, Abuja', 'demo-place-amaka-studio', 9.0765, 7.4786,
          'Wuse 2', 'Abuja', 'FCT', 'area')
  on conflict (business_id) do nothing;

  -- Opening hours: Monday to Saturday, 09:00-18:00 (WAT). Sunday closed. 0 = Sunday.
  insert into availability_rule (id, business_id, rule_type, day_of_week, start_time, end_time)
  select ('7a3e0000-0000-4000-a000-00000000006' || d)::uuid, v_business, 'weekly_hours', d, '09:00', '18:00'
  from generate_series(1, 6) as d
  on conflict (id) do nothing;

  -- Refund Policy (optional setup item), adapted from the salon & beauty template.
  insert into business_policy (id, business_id, service_id, content_type, content_markdown)
  values (
    '7a3e0000-0000-4000-a000-000000000020', v_business, null, 'markdown',
    'Your deposit secures your appointment. Cancel more than 24 hours before your appointment and '
    || 'your deposit is refunded in full. Cancellations within 24 hours, and missed appointments, '
    || 'keep the deposit. If we have to cancel, you get your deposit back. Please tell us about any '
    || 'allergies or skin sensitivities before your appointment.'
  )
  on conflict (id) do nothing;

  -- Rate card.
  insert into service_category (id, business_id, name)
  values (v_category, v_business, 'Makeup')
  on conflict (id) do nothing;

  insert into service (id, business_id, category_id, name, price_kobo, duration_minutes,
                       min_deposit_percent, description_markdown, sort_order)
  values
    (v_softglam, v_business, v_category, 'Soft glam makeup', 5000000, 90, 30,
     'A soft, polished look for birthdays, dinners and photo shoots. Lashes included.', 1),
    (v_bridal, v_business, v_category, 'Bridal makeup', 12000000, 150, 30,
     'Full bridal makeup for your wedding day, with a skin prep and lashes.', 2),
    (v_gele, v_business, v_category, 'Gele tying', 1000000, 30, 100,
     'Neat gele tying for weddings and owambe. Bring your own gele.', 3)
  on conflict (id) do nothing;

  -- Clients.
  insert into client (id, business_id, full_name, phone, email)
  values
    ('7a3e0000-0000-4000-a000-000000000031', v_business, 'Tunde Adeyemi',  '+2348000000001', 'tunde@example.com'),
    ('7a3e0000-0000-4000-a000-000000000032', v_business, 'Chioma Okafor',  '+2348000000002', 'chioma@example.com'),
    ('7a3e0000-0000-4000-a000-000000000033', v_business, 'Funke Bello',    '+2348000000003', 'funke@example.com'),
    ('7a3e0000-0000-4000-a000-000000000034', v_business, 'Ngozi Eze',      '+2348000000004', 'ngozi@example.com'),
    ('7a3e0000-0000-4000-a000-000000000035', v_business, 'Kemi Adebayo',   '+2348000000005', 'kemi@example.com')
  on conflict (id) do nothing;
end $$;

-- Bookings. Day offsets are working days from today (see iker_demo_workday). The default
-- booking_item row and the Refund Policy snapshot are filled in by the booking triggers, as for a
-- booking made through the link. Re-runs only move start_at / end_at.
with b(id, client_id, service_id, status, day_offset, start_time, minutes, price_kobo, deposit_kobo) as (
  values
    -- Tunde: the story's booking. Awaiting confirmation, ₦15,000 deposit proof pending review.
    ('7a3e0000-0000-4000-a000-000000000041'::uuid, '7a3e0000-0000-4000-a000-000000000031'::uuid,
     '7a3e0000-0000-4000-a000-000000000011'::uuid, 'awaiting_confirmation', 2, time '10:00', 90, 5000000::bigint, 1500000::bigint),
    -- Funke: yesterday-ish, soft glam, paid in full.
    ('7a3e0000-0000-4000-a000-000000000042', '7a3e0000-0000-4000-a000-000000000033',
     '7a3e0000-0000-4000-a000-000000000011', 'confirmed', -1, time '11:00', 90, 5000000, 1500000),
    -- Chioma: bridal, deposit confirmed, ₦84,000 balance remaining.
    ('7a3e0000-0000-4000-a000-000000000043', '7a3e0000-0000-4000-a000-000000000032',
     '7a3e0000-0000-4000-a000-000000000012', 'confirmed', 1, time '09:00', 150, 12000000, 3600000),
    -- Ngozi: gele tying, paid in full.
    ('7a3e0000-0000-4000-a000-000000000044', '7a3e0000-0000-4000-a000-000000000034',
     '7a3e0000-0000-4000-a000-000000000013', 'confirmed', 2, time '14:00', 30, 1000000, 1000000),
    -- Kemi: soft glam, deposit confirmed, ₦35,000 balance remaining.
    ('7a3e0000-0000-4000-a000-000000000045', '7a3e0000-0000-4000-a000-000000000035',
     '7a3e0000-0000-4000-a000-000000000011', 'confirmed', 3, time '12:00', 90, 5000000, 1500000)
)
insert into booking (id, business_id, service_id, client_id, source, status, start_at, end_at,
                     price_kobo, deposit_required_kobo, created_at)
select b.id, '7a3e0000-0000-4000-a000-000000000002', b.service_id, b.client_id, 'link', b.status,
       pg_temp.iker_demo_at(b.day_offset, b.start_time),
       pg_temp.iker_demo_at(b.day_offset, b.start_time) + make_interval(mins => b.minutes),
       b.price_kobo, b.deposit_kobo, now() - interval '3 days'
from b
on conflict (id) do update
  set start_at = excluded.start_at, end_at = excluded.end_at
  where booking.start_at is distinct from excluded.start_at;

-- Chioma's Saturday booking for the "now now" video (output/now-now-confirm-deposit): Bridal
-- makeup at ₦45,000 for this booking (the rate card item stays ₦120,000; the booking's own price
-- is what the booking page and its line item show), ₦15,000 deposit proof pending review,
-- Saturday 10:30 WAT. To put it back to "Awaiting confirmation" after a take, run
-- `fixtures/iker-demo/seed.sh reset-chioma`.
insert into booking (id, business_id, service_id, client_id, source, status, start_at, end_at,
                     price_kobo, deposit_required_kobo, created_at)
values ('7a3e0000-0000-4000-a000-000000000046', '7a3e0000-0000-4000-a000-000000000002',
        '7a3e0000-0000-4000-a000-000000000012', '7a3e0000-0000-4000-a000-000000000032', 'link',
        'awaiting_confirmation', pg_temp.iker_demo_saturday_at(time '10:30'),
        pg_temp.iker_demo_saturday_at(time '10:30') + interval '150 minutes',
        4500000, 1500000, now() - interval '4 days')
on conflict (id) do update
  set start_at = excluded.start_at, end_at = excluded.end_at
  where booking.start_at is distinct from excluded.start_at;

-- Payments. Tunde's deposit is the client's claim (pending review) with the sample receipt as
-- proof, exactly as the public booking flow writes it (method manual, payment_type deposit). The
-- others were confirmed by the owner. Payments are immutable, so re-runs leave them alone.
insert into payment (id, business_id, booking_id, amount_kobo, method, payment_type, proof_url,
                     status, paid_at, confirmed_at, confirmed_by_staff_id)
values
  ('7a3e0000-0000-4000-a000-000000000051', '7a3e0000-0000-4000-a000-000000000002',
   '7a3e0000-0000-4000-a000-000000000041', 1500000, 'manual', 'deposit',
   '7a3e0000-0000-4000-a000-000000000002/7a3e0000-0000-4000-a000-000000000051-sample-transfer-receipt.png',
   'pending_review', now() - interval '2 hours', null, null),
  ('7a3e0000-0000-4000-a000-000000000052', '7a3e0000-0000-4000-a000-000000000002',
   '7a3e0000-0000-4000-a000-000000000042', 1500000, 'manual', 'deposit', null,
   'confirmed', now() - interval '3 days', now() - interval '3 days', '7a3e0000-0000-4000-a000-000000000003'),
  ('7a3e0000-0000-4000-a000-000000000053', '7a3e0000-0000-4000-a000-000000000002',
   '7a3e0000-0000-4000-a000-000000000042', 3500000, 'manual', 'balance', null,
   'confirmed', now() - interval '1 day', now() - interval '1 day', '7a3e0000-0000-4000-a000-000000000003'),
  ('7a3e0000-0000-4000-a000-000000000054', '7a3e0000-0000-4000-a000-000000000002',
   '7a3e0000-0000-4000-a000-000000000043', 3600000, 'manual', 'deposit', null,
   'confirmed', now() - interval '2 days', now() - interval '2 days', '7a3e0000-0000-4000-a000-000000000003'),
  ('7a3e0000-0000-4000-a000-000000000055', '7a3e0000-0000-4000-a000-000000000002',
   '7a3e0000-0000-4000-a000-000000000044', 1000000, 'manual', 'full', null,
   'confirmed', now() - interval '2 days', now() - interval '2 days', '7a3e0000-0000-4000-a000-000000000003'),
  ('7a3e0000-0000-4000-a000-000000000056', '7a3e0000-0000-4000-a000-000000000002',
   '7a3e0000-0000-4000-a000-000000000045', 1500000, 'manual', 'deposit', null,
   'confirmed', now() - interval '1 day', now() - interval '1 day', '7a3e0000-0000-4000-a000-000000000003'),
  ('7a3e0000-0000-4000-a000-000000000057', '7a3e0000-0000-4000-a000-000000000002',
   '7a3e0000-0000-4000-a000-000000000046', 1500000, 'manual', 'deposit',
   '7a3e0000-0000-4000-a000-000000000002/7a3e0000-0000-4000-a000-000000000057-sample-transfer-receipt.png',
   'pending_review', now() - interval '3 hours', null, null)
on conflict (id) do nothing;

commit;

select b.id, c.full_name, s.name as service, b.status,
       to_char(b.start_at at time zone 'Africa/Lagos', 'Dy DD Mon HH24:MI') as starts_wat,
       b.price_kobo / 100 as price_naira,
       (coalesce(sum(p.amount_kobo) filter (where p.status = 'confirmed'), 0) / 100)::bigint as paid_so_far_naira,
       string_agg(p.status, ', ' order by p.created_at) as payments
from booking b
join client c on c.id = b.client_id
join service s on s.id = b.service_id
left join payment p on p.booking_id = b.id
where b.business_id = '7a3e0000-0000-4000-a000-000000000002'
group by b.id, c.full_name, s.name
order by b.start_at;
