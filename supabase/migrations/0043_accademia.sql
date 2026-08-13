-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0043
-- Accademia: video YouTube scelti dallo staff, raggruppati per categoria.
-- ============================================================================
-- Lo staff gestisce i video dal gestionale; i soci li vedono sul portale,
-- in sola lettura. Ogni video appartiene a una categoria (Base, Avanzato...)
-- ed ha un ordine, per decidere come appaiono nella scheda.
--
-- Additiva: due tabelle nuove, non tocca nulla di esistente.
-- ============================================================================

-- ── Categorie ───────────────────────────────────────────────────────────────
create table if not exists portale.accademia_categorie (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  ordine     integer not null default 0,
  created_at timestamptz not null default now()
);

alter table portale.accademia_categorie enable row level security;

-- Lo staff gestisce; i soci (autenticati) leggono.
create policy "staff_all_acc_categorie" on portale.accademia_categorie
  for all to authenticated
  using (is_active_staff()) with check (is_active_staff());
create policy "socio_legge_acc_categorie" on portale.accademia_categorie
  for select to authenticated
  using (true);

grant select, insert, update, delete on portale.accademia_categorie to authenticated;

-- ── Video ───────────────────────────────────────────────────────────────────
create table if not exists portale.accademia_video (
  id           uuid primary key default gen_random_uuid(),
  categoria_id uuid references portale.accademia_categorie(id) on delete cascade,
  titolo       text not null,
  youtube_id   text not null,          -- solo l'id, es. dQw4w9WgXcQ
  descrizione  text,
  ordine       integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists idx_accademia_video_cat
  on portale.accademia_video (categoria_id, ordine);

alter table portale.accademia_video enable row level security;

create policy "staff_all_acc_video" on portale.accademia_video
  for all to authenticated
  using (is_active_staff()) with check (is_active_staff());
create policy "socio_legge_acc_video" on portale.accademia_video
  for select to authenticated
  using (true);

grant select, insert, update, delete on portale.accademia_video to authenticated;
