-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0007
-- Workflow di chiusura uscita con addebiti differiti
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ENUM stato uscita
-- ----------------------------------------------------------------------------
create type outing_status as enum ('bozza', 'chiusa');

-- ----------------------------------------------------------------------------
-- AGGIUNTE alla tabella outings
-- ----------------------------------------------------------------------------
alter table outings
  add column if not exists status outing_status not null default 'bozza',
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references auth.users(id) on delete set null;

create index if not exists idx_outings_status on outings(status);

-- Le uscite gia' esistenti dalle migrazioni precedenti sono considerate chiuse
-- (perche' i loro movimenti sono gia' stati generati nel vecchio flusso)
update outings set status = 'chiusa', closed_at = created_at where status = 'bozza' and exists (
  select 1 from movements m where m.outing_id = outings.id
);

-- ----------------------------------------------------------------------------
-- AGGIUNTE alla tabella outing_participants
-- (dati di addebito intent: cosa va addebitato alla chiusura)
-- ----------------------------------------------------------------------------
alter table outing_participants
  add column if not exists rental_charge_amount numeric(10,2),
  add column if not exists notes text;

comment on column outing_participants.rental_charge_amount is
  'Importo del noleggio (se applicabile). Calcolato alla chiusura in base a rental_type, ma puo'' essere personalizzato qui.';

-- ----------------------------------------------------------------------------
-- AGGIUNTA per movimenti: collegamento ai participant per storno preciso
-- ----------------------------------------------------------------------------
alter table movements
  add column if not exists participant_id uuid references outing_participants(id) on delete set null,
  add column if not exists is_reversed boolean not null default false,
  add column if not exists reversed_by_movement_id uuid references movements(id) on delete set null;

create index if not exists idx_movements_participant on movements(participant_id);
create index if not exists idx_movements_outing_active on movements(outing_id, is_reversed)
  where is_reversed = false;

comment on column movements.is_reversed is
  'Se true: questo movimento e'' stato annullato da uno storno. Mantenuto per audit ma non concorre al saldo (escluso dalle view).';
comment on column movements.reversed_by_movement_id is
  'Movimento di storno che ha annullato questo movimento.';

-- ----------------------------------------------------------------------------
-- VIEW aggiornate: escludi movimenti stornati dai saldi
-- ----------------------------------------------------------------------------
drop view if exists member_wallets;
create view member_wallets as
select
  m.id as member_id,
  m.first_name,
  m.last_name,
  m.membership_number,
  coalesce(sum(mv.amount), 0)::numeric(10,2) as monetary_balance,
  coalesce(sum(mv.amount) filter (where mv.amount > 0 and mv.paid = true), 0)::numeric(10,2) as total_received,
  coalesce(sum(-mv.amount) filter (where mv.amount < 0 and mv.paid = false), 0)::numeric(10,2) as total_outstanding,
  count(mv.id) as movements_count
from members m
left join movements mv on mv.member_id = m.id and mv.is_reversed = false
group by m.id, m.first_name, m.last_name, m.membership_number;

drop view if exists member_lift_balances;
create view member_lift_balances as
select
  member_id,
  discipline,
  sum(lifts_total - lifts_used)::integer as lifts_remaining,
  sum(lifts_total)::integer as lifts_total,
  count(*)::integer as packages_count,
  count(*) filter (where is_exhausted = false)::integer as packages_active
from packages
where is_subscription = false  -- solo i pacchetti a lift, non gli abbonamenti
group by member_id, discipline;
