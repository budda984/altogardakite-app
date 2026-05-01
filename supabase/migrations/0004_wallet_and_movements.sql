-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0004
-- Wallet, pacchetti, movimenti (crediti e debiti dei soci)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ENUM
-- ----------------------------------------------------------------------------
create type lift_discipline as enum ('kite', 'wingfoil', 'sit_kite', 'wingfoil_adattato', 'altro');

create type movement_type as enum (
  'acquisto_pacchetto',  -- compra un pacchetto da N lift (puo' essere pagato o no)
  'pagamento',           -- chiude debito o accredita prepagato senza pacchetto
  'consumo_lift',        -- usa un lift da pacchetto (uscita)
  'addebito',            -- servizio fornito ma non pagato (genera debito)
  'rimborso',            -- restituzione denaro
  'correzione'           -- aggiustamento manuale (solo admin)
);

-- ----------------------------------------------------------------------------
-- TABELLA packages (pacchetti acquistati dai soci, con lift residui)
-- ----------------------------------------------------------------------------
create table packages (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete restrict,
  service_id uuid references services(id) on delete set null,

  -- snapshot del servizio
  service_name_snapshot text not null,
  discipline lift_discipline not null default 'altro',

  -- crediti
  lifts_total integer not null check (lifts_total >= 0),
  lifts_used integer not null default 0 check (lifts_used >= 0),
  -- vincolo: non si puo' usare piu' di quanto disponibile
  constraint chk_lifts_consistency check (lifts_used <= lifts_total),

  -- prezzo (snapshot al momento dell'acquisto)
  total_price numeric(10,2) not null check (total_price >= 0),

  -- stato derivato esposto come campo per query veloci
  is_exhausted boolean generated always as (lifts_used >= lifts_total) stored,

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_packages_member on packages(member_id);
create index idx_packages_active on packages(member_id, is_exhausted) where is_exhausted = false;
create index idx_packages_discipline on packages(discipline);

create trigger trg_packages_updated_at before update on packages
  for each row execute procedure set_updated_at();

-- ----------------------------------------------------------------------------
-- TABELLA movements (libro mastro: ogni evento finanziario o di consumo)
-- ----------------------------------------------------------------------------
create table movements (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete restrict,
  movement_type movement_type not null,
  movement_date timestamptz not null default now(),

  -- descrizione human-readable
  description text not null,

  -- componente monetaria (positivo = denaro entrato, negativo = denaro dovuto / addebito)
  -- esempi:
  --   acquisto pacchetto pagato: +300 (entrata)
  --   acquisto pacchetto NON pagato: 0 (nessun movimento monetario, ma genera debito implicito? no: usiamo 'addebito')
  --   pagamento: +50 (incasso)
  --   addebito: -35 (debito generato)
  --   rimborso: -50 (uscita di cassa)
  amount numeric(10,2) not null default 0,

  -- componente lift (positivo = lift accreditati, negativo = consumati)
  --   acquisto pacchetto 10 lift: +10
  --   consumo: -1
  lift_delta integer not null default 0,
  lift_discipline lift_discipline,

  -- riferimenti opzionali
  package_id uuid references packages(id) on delete set null,
  service_id uuid references services(id) on delete set null,
  outing_id uuid references outings(id) on delete set null,

  -- pagamento (solo per movement_type che movimentano denaro)
  paid boolean not null default false,
  payment_method payment_method,

  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_movements_member on movements(member_id, movement_date desc);
create index idx_movements_type on movements(movement_type);
create index idx_movements_unpaid on movements(member_id, paid) where paid = false;
create index idx_movements_outing on movements(outing_id);
create index idx_movements_package on movements(package_id);

-- ----------------------------------------------------------------------------
-- VIEW: wallet di ogni socio
-- ----------------------------------------------------------------------------
create or replace view member_wallets as
select
  m.id as member_id,
  m.first_name,
  m.last_name,
  m.membership_number,
  -- saldo monetario: somma di tutti gli amount con segno
  -- positivo = il socio e' a credito (raro: pagamento in eccesso)
  -- negativo = il socio deve ancora soldi alla scuola
  coalesce(sum(mv.amount), 0)::numeric(10,2) as monetary_balance,
  -- totale incassato (per statistiche)
  coalesce(sum(mv.amount) filter (where mv.amount > 0 and mv.paid = true), 0)::numeric(10,2) as total_received,
  -- totale ancora da incassare (debiti aperti)
  coalesce(sum(-mv.amount) filter (where mv.amount < 0 and mv.paid = false), 0)::numeric(10,2) as total_outstanding,
  -- contatore movimenti
  count(mv.id) as movements_count
from members m
left join movements mv on mv.member_id = m.id
group by m.id, m.first_name, m.last_name, m.membership_number;

-- ----------------------------------------------------------------------------
-- VIEW: lift residui per socio e disciplina
-- ----------------------------------------------------------------------------
create or replace view member_lift_balances as
select
  member_id,
  discipline,
  sum(lifts_total - lifts_used)::integer as lifts_remaining,
  sum(lifts_total)::integer as lifts_total,
  count(*)::integer as packages_count,
  count(*) filter (where is_exhausted = false)::integer as packages_active
from packages
group by member_id, discipline;

-- ----------------------------------------------------------------------------
-- FUNCTION: consuma un lift dal pacchetto piu' vecchio non esaurito
-- (per la disciplina richiesta). Ritorna l'id del package usato, oppure null.
-- ----------------------------------------------------------------------------
create or replace function consume_lift(
  p_member_id uuid,
  p_discipline lift_discipline,
  p_outing_id uuid default null,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  pkg packages%rowtype;
begin
  -- Trova il pacchetto piu' vecchio non esaurito per quella disciplina
  select *
    into pkg
    from packages
    where member_id = p_member_id
      and discipline = p_discipline
      and is_exhausted = false
    order by created_at asc
    limit 1
    for update;

  if not found then
    return null;
  end if;

  -- Scala il lift
  update packages
    set lifts_used = lifts_used + 1
    where id = pkg.id;

  -- Registra il movimento
  insert into movements (
    member_id, movement_type, description, lift_delta, lift_discipline,
    package_id, outing_id, notes
  ) values (
    p_member_id, 'consumo_lift',
    'Consumo lift ' || p_discipline || ' (' || pkg.service_name_snapshot || ')',
    -1, p_discipline, pkg.id, p_outing_id, p_notes
  );

  return pkg.id;
end;
$$;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table packages enable row level security;
alter table movements enable row level security;

create policy "staff_all_packages" on packages
  for all to authenticated
  using (is_active_staff()) with check (is_active_staff());

create policy "staff_all_movements" on movements
  for all to authenticated
  using (is_active_staff()) with check (is_active_staff());

-- ----------------------------------------------------------------------------
-- MIGRAZIONE DATI: gli addebiti esistenti in member_services diventano
-- movimenti di tipo 'addebito' (se non pagati) o 'pagamento' (se pagati)
-- ----------------------------------------------------------------------------
insert into movements (
  member_id, movement_type, movement_date, description,
  amount, paid, payment_method, service_id, notes, created_at
)
select
  ms.member_id,
  case
    when ms.paid then 'pagamento'::movement_type
    else 'addebito'::movement_type
  end,
  ms.sold_at,
  ms.service_name_snapshot ||
    case when ms.quantity > 1 then ' (×' || ms.quantity || ')' else '' end,
  case when ms.paid then ms.total_price else -ms.total_price end,
  ms.paid,
  ms.payment_method,
  ms.service_id,
  ms.notes,
  ms.created_at
from member_services ms
where not exists (
  -- evita doppia migrazione
  select 1 from movements m where m.service_id = ms.service_id
    and m.member_id = ms.member_id
    and m.created_at = ms.created_at
);
