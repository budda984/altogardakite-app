-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0002
-- Catalogo servizi (listino 2026), bilancio soci, transazioni attrezzatura
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ENUM TYPES
-- ----------------------------------------------------------------------------
create type service_category as enum (
  'lift_singolo',
  'lift_pacchetto',
  'lift_assistito',
  'iniziazione',
  'pacchetto_stagionale',
  'noleggio_attrezzatura',
  'wingfoil',
  'combo',
  'storage',
  'altro'
);

create type payment_method as enum ('contanti', 'bancomat', 'bonifico', 'altro');

create type equipment_transaction_type as enum (
  'acquisto', 'vendita', 'dismissione', 'manutenzione', 'cessione'
);

-- ----------------------------------------------------------------------------
-- SERVICES CATALOG (listino prezzi)
-- ----------------------------------------------------------------------------
create table services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category service_category not null default 'altro',
  unit_price numeric(10,2) not null,
  included_lifts integer not null default 0,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_services_category on services(category);
create index idx_services_active on services(is_active);

create trigger trg_services_updated_at before update on services
  for each row execute procedure set_updated_at();

-- ----------------------------------------------------------------------------
-- MEMBER SERVICE PURCHASES (ledger / addebiti per socio)
-- ----------------------------------------------------------------------------
create table member_services (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete restrict,
  service_id uuid references services(id) on delete set null,

  -- snapshot dei dati al momento dell'addebito (immutabili)
  service_name_snapshot text not null,
  category service_category,

  -- quantita e prezzi
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(10,2) not null,
  total_price numeric(10,2) not null,

  -- pagamento
  paid boolean not null default false,
  payment_date date,
  payment_method payment_method,

  -- collegamento opzionale a un'uscita
  outing_id uuid references outings(id) on delete set null,
  notes text,

  -- metadata
  sold_at timestamptz not null default now(),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_ms_member on member_services(member_id);
create index idx_ms_paid on member_services(paid);
create index idx_ms_sold_at on member_services(sold_at desc);
create index idx_ms_outing on member_services(outing_id);

create trigger trg_member_services_updated_at before update on member_services
  for each row execute procedure set_updated_at();

-- ----------------------------------------------------------------------------
-- EQUIPMENT TRANSACTIONS (acquisto, vendita, dismissione)
-- ----------------------------------------------------------------------------
create table equipment_transactions (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references equipment(id) on delete cascade,
  transaction_type equipment_transaction_type not null,
  transaction_date date not null default current_date,
  amount numeric(10,2),

  -- venduto a un socio o esterno
  member_id uuid references members(id) on delete set null,
  buyer_name text,

  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index idx_equipment_tx_equipment on equipment_transactions(equipment_id);
create index idx_equipment_tx_date on equipment_transactions(transaction_date desc);
create index idx_equipment_tx_type on equipment_transactions(transaction_type);

-- ----------------------------------------------------------------------------
-- VIEW: bilancio per socio
-- ----------------------------------------------------------------------------
create or replace view member_balances as
select
  m.id as member_id,
  m.first_name,
  m.last_name,
  m.membership_number,
  coalesce(sum(ms.total_price), 0)::numeric(10,2) as total_charged,
  coalesce(sum(ms.total_price) filter (where ms.paid = true), 0)::numeric(10,2) as total_paid,
  coalesce(sum(ms.total_price) filter (where ms.paid = false), 0)::numeric(10,2) as total_outstanding,
  count(ms.id) as services_count,
  count(ms.id) filter (where ms.paid = false) as unpaid_count
from members m
left join member_services ms on ms.member_id = m.id
group by m.id, m.first_name, m.last_name, m.membership_number;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table services enable row level security;
alter table member_services enable row level security;
alter table equipment_transactions enable row level security;

create policy "auth_all_services" on services for all to authenticated using (true) with check (true);
create policy "auth_all_member_services" on member_services for all to authenticated using (true) with check (true);
create policy "auth_all_equipment_transactions" on equipment_transactions for all to authenticated using (true) with check (true);

-- ----------------------------------------------------------------------------
-- SEED: servizi dal listino 2026
-- ----------------------------------------------------------------------------
insert into services (slug, name, category, unit_price, included_lifts, sort_order) values
  -- Lift singoli
  ('lift_singolo_kw', 'Lift singolo kite o wing', 'lift_singolo', 35.00, 1, 10),
  ('lift_singolo_under18_kw', 'Lift singolo under 18 kite o wing', 'lift_singolo', 30.00, 1, 11),
  ('lift_assistito', 'Lift assistito', 'lift_assistito', 50.00, 1, 12),

  -- Pacchetti lift
  ('pacchetto_10_lift_kw', '10 lift kite o wing', 'lift_pacchetto', 300.00, 10, 20),
  ('pacchetto_10_lift_under18_kw', '10 lift under 18 kite o wing', 'lift_pacchetto', 250.00, 10, 21),
  ('pacchetto_10_lift_assistito_under18_over65', '10 lift assistiti under 18 / over 65 kitesurf o wingfoil', 'lift_assistito', 400.00, 10, 22),
  ('pacchetto_10_lift_assistito_sit_wf', '10 lift assistiti sit''n''kite o wingfoil adattato', 'lift_assistito', 500.00, 10, 23),

  -- Iniziazione
  ('iniziazione_kw_wf_adattato', 'Iniziazione kite / wing / wingfoil adattato (5 uscite + teoria)', 'iniziazione', 500.00, 5, 30),
  ('iniziazione_sit_kite', 'Iniziazione sit''n''kite (5 uscite + teoria)', 'iniziazione', 750.00, 5, 31),

  -- Pacchetti stagionali
  ('stagionale_kite_infrasettimanale', 'Pacchetto lift stagionale kite infrasettimanale (min. 2 partecipanti)', 'pacchetto_stagionale', 700.00, 0, 40),
  ('stagionale_kite_full', 'Pacchetto lift stagionale kite (1 uscita/giorno, min. 2 partecipanti)', 'pacchetto_stagionale', 800.00, 0, 41),
  ('stagionale_attrezzatura', 'Pacchetto attrezzatura sportiva stagionale (collegato al pacchetto lift)', 'pacchetto_stagionale', 600.00, 0, 42),

  -- Noleggi attrezzatura
  ('noleggio_kite_tavola', 'Noleggio kite + tavola', 'noleggio_attrezzatura', 35.00, 0, 50),
  ('noleggio_kite', 'Noleggio kite', 'noleggio_attrezzatura', 30.00, 0, 51),
  ('noleggio_tavola', 'Noleggio tavola', 'noleggio_attrezzatura', 10.00, 0, 52),
  ('noleggio_trapezio', 'Noleggio trapezio', 'noleggio_attrezzatura', 5.00, 0, 53),
  ('noleggio_muta', 'Noleggio muta', 'noleggio_attrezzatura', 10.00, 0, 54),
  ('noleggio_giubbotto_casco', 'Noleggio giubbotto o casco', 'noleggio_attrezzatura', 5.00, 0, 55),

  -- Wingfoil
  ('noleggio_wingfoil', 'Noleggio wingfoil tavola + ala', 'wingfoil', 60.00, 0, 60),

  -- Combo wingfoil + lift
  ('combo_1lift_wingfoil', '1 lift + wingfoil tavola + ala', 'combo', 90.00, 1, 61),
  ('combo_5lift_wingfoil', '5 lift + wingfoil tavola + ala', 'combo', 400.00, 5, 62),
  ('combo_10lift_wingfoil', '10 lift + wingfoil tavola + ala', 'combo', 700.00, 10, 63),

  -- Combo lift + kite + tavola
  ('combo_1lift_kite_tavola', '1 lift + kite + tavola', 'combo', 80.00, 1, 70),
  ('combo_5lift_kite_tavola', '5 lift + kite + tavola', 'combo', 350.00, 5, 71),
  ('combo_10lift_kite_tavola', '10 lift + kite + tavola', 'combo', 600.00, 10, 72),

  -- Storage stagionale
  ('storage_kite', 'Storage stagionale kitesurf', 'storage', 150.00, 0, 80),
  ('storage_wingfoil', 'Storage stagionale wingfoil', 'storage', 250.00, 0, 81)
;
