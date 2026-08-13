-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0044
-- Accademia: i video preferiti di ogni socio.
-- ============================================================================
-- Ogni socio puo' segnare i video che vuole ritrovare in fretta. Una riga =
-- un socio + un video. Il socio vede e gestisce solo i propri preferiti.
--
-- Additiva: una tabella nuova e due funzioni, non tocca nulla di esistente.
-- ============================================================================

create table if not exists portale.accademia_preferiti (
  member_id  uuid not null references members(id) on delete cascade,
  video_id   uuid not null references portale.accademia_video(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (member_id, video_id)
);

alter table portale.accademia_preferiti enable row level security;

-- Il socio vede e gestisce SOLO i propri preferiti.
create policy "socio_gestisce_preferiti" on portale.accademia_preferiti
  for all to authenticated
  using (member_id = portale.socio_member_id())
  with check (member_id = portale.socio_member_id());

-- Lo staff puo' leggerli (utile per capire cosa guardano), non e' obbligatorio.
create policy "staff_legge_preferiti" on portale.accademia_preferiti
  for select to authenticated
  using (is_active_staff());

grant select, insert, delete on portale.accademia_preferiti to authenticated;

-- ── Funzioni per il socio ───────────────────────────────────────────────────
-- Gli id dei video che il socio ha messo tra i preferiti.
create or replace function portale.preferiti_video()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select video_id from portale.accademia_preferiti
   where member_id = portale.socio_member_id();
$$;

revoke all on function portale.preferiti_video() from public;
grant execute on function portale.preferiti_video() to authenticated;

-- Accende o spegne un preferito. Ritorna lo stato finale (true = preferito).
create or replace function portale.preferito_imposta(p_video_id uuid, p_attivo boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member uuid;
begin
  v_member := portale.socio_member_id();
  if v_member is null then
    return false;
  end if;

  if p_attivo then
    insert into portale.accademia_preferiti(member_id, video_id)
    values (v_member, p_video_id)
    on conflict (member_id, video_id) do nothing;
  else
    delete from portale.accademia_preferiti
     where member_id = v_member and video_id = p_video_id;
  end if;

  return p_attivo;
end;
$$;

revoke all on function portale.preferito_imposta(uuid, boolean) from public;
grant execute on function portale.preferito_imposta(uuid, boolean) to authenticated;
