-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0042
-- Note del planning: promemoria dello staff su un intervallo di giorni.
-- ============================================================================
-- Una nota testuale che appare nel planning dal giorno "da" al giorno "a"
-- (estremi inclusi), valida per l'intera giornata. Solo gestionale: i soci
-- non la vedono. La gestisce tutto lo staff.
--
-- Additiva: nuova tabella, non tocca nulla di esistente.
-- ============================================================================

create table if not exists planning_note (
  id           uuid primary key default gen_random_uuid(),
  testo        text not null,
  data_da      date not null,
  data_a       date not null,
  created_by   uuid references auth.users(id),
  created_by_name text,
  created_at   timestamptz not null default now(),
  constraint intervallo_valido check (data_a >= data_da)
);

-- Ricerca per giorno: "quali note coprono oggi?"
create index if not exists idx_planning_note_intervallo
  on planning_note (data_da, data_a);

alter table planning_note enable row level security;

-- Tutto lo staff legge, crea e cancella. I soci non hanno accesso.
create policy "staff_all_planning_note" on planning_note
  for all to authenticated
  using (is_active_staff()) with check (is_active_staff());

grant select, insert, delete on planning_note to authenticated;
