-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0023
-- Registro attivita (audit log): chi fa cosa nell'app.
-- Le API registrano gli eventi principali; il nome dell'autore e'
-- denormalizzato cosi il log resta leggibile nel tempo.
-- ============================================================================

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid references profiles(id) on delete set null,
  actor_name text,
  action text not null,          -- es. 'booking.create', 'member.create'
  description text not null,     -- messaggio leggibile in italiano
  metadata jsonb                  -- dettagli extra facoltativi
);

create index if not exists idx_activity_log_created
  on activity_log(created_at desc);
create index if not exists idx_activity_log_action
  on activity_log(action);

alter table activity_log enable row level security;

create policy "activity_log_select" on activity_log
  for select to authenticated using (true);
create policy "activity_log_insert" on activity_log
  for insert to authenticated with check (true);
-- niente update/delete: il registro non si modifica
