-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0019
-- Tabella per salvare i piani di lavoro del Planner avanzato,
-- condivisi tra tutti gli utenti staff.
-- Un piano per combinazione (giorno, sessione).
-- ============================================================================

create table if not exists planner_drafts (
  id uuid primary key default gen_random_uuid(),
  plan_date date not null,
  session_template_id uuid not null references session_templates(id) on delete cascade,
  columns jsonb not null default '[]'::jsonb,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  unique (plan_date, session_template_id)
);

alter table planner_drafts enable row level security;

-- Gli utenti autenticati (staff) possono leggere e scrivere i piani;
-- il controllo di ruolo avviene a livello API.
create policy "planner_drafts_select" on planner_drafts
  for select to authenticated using (true);
create policy "planner_drafts_insert" on planner_drafts
  for insert to authenticated with check (true);
create policy "planner_drafts_update" on planner_drafts
  for update to authenticated using (true) with check (true);
create policy "planner_drafts_delete" on planner_drafts
  for delete to authenticated using (true);
