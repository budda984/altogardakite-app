-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0006
-- Abbonamenti stagionali: lift illimitati nella finestra di validita'
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABELLA app_settings (configurazioni globali key-value)
-- Usiamo questa per memorizzare le date di stagione e altri parametri.
-- ----------------------------------------------------------------------------
create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table app_settings enable row level security;

-- Tutti gli staff leggono le configurazioni
create policy "staff_read_app_settings" on app_settings
  for select to authenticated
  using (is_active_staff());

-- Solo gli admin modificano le configurazioni
create policy "admins_write_app_settings" on app_settings
  for insert to authenticated
  with check (is_admin());
create policy "admins_update_app_settings" on app_settings
  for update to authenticated
  using (is_admin())
  with check (is_admin());
create policy "admins_delete_app_settings" on app_settings
  for delete to authenticated
  using (is_admin());

-- Default: stagione 1 aprile - 31 ottobre (modificabile da admin)
insert into app_settings (key, value, description) values
  ('season', '{"start_month_day": "04-01", "end_month_day": "10-31"}',
   'Date di inizio e fine stagione, formato MM-DD. Usate per pre-compilare validita abbonamenti stagionali.')
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- AGGIUNTE alla tabella services
-- ----------------------------------------------------------------------------
alter table services
  add column if not exists is_subscription boolean not null default false;

comment on column services.is_subscription is
  'Se true: l''acquisto crea un abbonamento con validita'' temporale, lift illimitati. Se false: pacchetto con conteggio lift.';

-- Marca come abbonamenti i 3 pacchetti stagionali del listino
update services set is_subscription = true where slug in (
  'stagionale_kite_infrasettimanale',
  'stagionale_kite_full',
  'stagionale_attrezzatura'
);

-- ----------------------------------------------------------------------------
-- AGGIUNTE alla tabella packages
-- ----------------------------------------------------------------------------
alter table packages
  add column if not exists is_subscription boolean not null default false,
  add column if not exists valid_from date,
  add column if not exists valid_until date;

comment on column packages.is_subscription is
  'Se true: abbonamento stagionale, lift illimitati nella finestra valid_from..valid_until.';
comment on column packages.valid_from is 'Data inizio validita (solo per abbonamenti).';
comment on column packages.valid_until is 'Data fine validita (solo per abbonamenti).';

create index if not exists idx_packages_subscription_active
  on packages(member_id, discipline)
  where is_subscription = true;

-- Vincoli logici: se e' un abbonamento, le date sono obbligatorie
-- (lasciamo lift_total = 0 e lifts_used = 0 per evitare conflitti col vincolo esistente)

-- ----------------------------------------------------------------------------
-- VIEW: abbonamenti attualmente attivi per ogni socio
-- ----------------------------------------------------------------------------
create or replace view member_active_subscriptions as
select
  p.id as package_id,
  p.member_id,
  p.service_name_snapshot,
  p.discipline,
  p.valid_from,
  p.valid_until,
  p.total_price,
  (p.valid_until - current_date)::integer as days_remaining
from packages p
where p.is_subscription = true
  and p.valid_from <= current_date
  and p.valid_until >= current_date;

-- ----------------------------------------------------------------------------
-- FUNCTION: ha un abbonamento attivo per la disciplina X?
-- ----------------------------------------------------------------------------
create or replace function has_active_subscription(
  p_member_id uuid,
  p_discipline lift_discipline
) returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from packages
    where member_id = p_member_id
      and is_subscription = true
      and discipline = p_discipline
      and valid_from <= current_date
      and valid_until >= current_date
  );
$$;
