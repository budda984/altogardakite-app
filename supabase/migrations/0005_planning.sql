-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0005
-- Planning con template di sessione (Peler / Ora / Ora late / Wingfoil)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABELLA session_templates (le sessioni standard configurabili per stagione)
-- ----------------------------------------------------------------------------
create table session_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,                          -- "Peler", "Ora", "Ora late", "Wingfoil mattina"
  discipline lift_discipline not null,         -- kite, wingfoil, ecc.
  wind_session wind_session,                   -- peler / ora / ora_serale (puo' essere null per wingfoil)
  default_departure_time time not null,
  default_return_time time not null,
  sort_order integer not null default 0,       -- ordine di visualizzazione nella giornata
  is_default boolean not null default true,    -- se true, viene generata automaticamente ogni giorno
  is_active boolean not null default true,     -- per disabilitare temporaneamente senza eliminare
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_session_templates_sort on session_templates(sort_order);
create index idx_session_templates_active on session_templates(is_active) where is_active = true;

create trigger trg_session_templates_updated_at before update on session_templates
  for each row execute procedure set_updated_at();

-- ----------------------------------------------------------------------------
-- AGGIUNTE alla tabella outings
-- ----------------------------------------------------------------------------
alter table outings
  add column if not exists session_template_id uuid references session_templates(id) on delete set null,
  add column if not exists discipline lift_discipline;

create index if not exists idx_outings_template on outings(session_template_id);
create index if not exists idx_outings_date_template on outings(outing_date, session_template_id);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table session_templates enable row level security;

create policy "staff_all_session_templates" on session_templates
  for all to authenticated
  using (is_active_staff()) with check (is_active_staff());

-- ----------------------------------------------------------------------------
-- SEED: template iniziali (orari indicativi, modificabili dalla UI)
-- ----------------------------------------------------------------------------
insert into session_templates
  (name, discipline, wind_session, default_departure_time, default_return_time, sort_order, is_default, notes)
values
  ('Peler', 'kite', 'peler', '08:00', '12:00', 10, true,
   'Sessione mattutina con vento Peler dal nord'),
  ('Ora', 'kite', 'ora', '13:00', '16:30', 20, true,
   'Sessione pomeridiana con vento Ora dal sud'),
  ('Ora late', 'kite', 'ora_serale', '16:30', '19:30', 30, true,
   'Sessione serale tardo pomeriggio'),
  ('Wingfoil mattina', 'wingfoil', 'peler', '08:30', '12:00', 15, false,
   'Sessione wingfoil mattutina (non generata automaticamente)'),
  ('Wingfoil pomeriggio', 'wingfoil', 'ora', '13:30', '17:00', 25, false,
   'Sessione wingfoil pomeridiana (non generata automaticamente)')
;
