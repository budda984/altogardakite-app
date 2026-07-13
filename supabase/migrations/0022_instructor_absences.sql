-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0022
-- Assenze istruttori: giorno intero (session_template_id null) oppure
-- legate a una specifica sessione (Peler, Ora...).
-- Promemoria visivo nel planning; non blocca nulla.
-- ============================================================================

create table if not exists instructor_absences (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references instructors(id) on delete cascade,
  absence_date date not null,
  session_template_id uuid references session_templates(id) on delete cascade,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_instructor_absences_date
  on instructor_absences(absence_date);

alter table instructor_absences enable row level security;

create policy "instructor_absences_select" on instructor_absences
  for select to authenticated using (true);
create policy "instructor_absences_insert" on instructor_absences
  for insert to authenticated with check (true);
create policy "instructor_absences_delete" on instructor_absences
  for delete to authenticated using (true);
