-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0040
-- Avvisi vento: chi li vuole ricevere e cosa e' gia' stato mandato.
-- ============================================================================
-- Il portale controlla due volte al giorno le previsioni (Open-Meteo) e,
-- quando vede peler forte o ora forte nei giorni successivi, crea un avviso
-- per i soci che hanno messo la spunta nella pagina Vento. L'avviso fa
-- scattare la push con la catena gia' esistente (trigger su portale.avvisi).
--
-- Additiva: nessuna tabella o policy esistente viene toccata.
-- ============================================================================

-- ── Chi vuole gli avvisi ────────────────────────────────────────────────────
-- Una riga = un socio iscritto. Togliere la spunta cancella la riga.
create table if not exists portale.vento_iscritti (
  member_id  uuid primary key references members(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table portale.vento_iscritti enable row level security;

-- Lo staff vede e gestisce tutto, come nel resto del portale.
create policy "staff_all_vento_iscritti" on portale.vento_iscritti
  for all to authenticated
  using (is_active_staff()) with check (is_active_staff());

-- Il socio vede solo la propria riga (per sapere se la spunta e' accesa).
create policy "socio_legge_vento_iscritti" on portale.vento_iscritti
  for select to authenticated
  using (member_id = portale.socio_member_id());

grant select on portale.vento_iscritti to authenticated;

-- Il controllo automatico gira con la service role: le serve leggere l'elenco.
grant select on portale.vento_iscritti to service_role;

-- ── Cosa e' gia' stato mandato ──────────────────────────────────────────────
-- Chiave (tipo, giorno): lo stesso peler dello stesso giorno si annuncia una
-- volta sola, anche se il controllo gira due volte al giorno per una settimana.
create table if not exists portale.vento_avvisi_inviati (
  tipo       text not null check (tipo in ('peler', 'ora')),
  giorno     date not null,
  dettaglio  text,
  quanti     integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (tipo, giorno)
);

alter table portale.vento_avvisi_inviati enable row level security;

-- Solo lo staff lo consulta; il socio non c'entra nulla.
create policy "staff_all_vento_inviati" on portale.vento_avvisi_inviati
  for all to authenticated
  using (is_active_staff()) with check (is_active_staff());

grant select on portale.vento_avvisi_inviati to authenticated;
grant select, insert on portale.vento_avvisi_inviati to service_role;

-- Il controllo automatico crea gli avvisi con la service role: senza questo
-- grant fallirebbe con "permission denied for table avvisi" (vedi 0037).
grant insert on portale.avvisi to service_role;

-- ── Funzioni per il socio ───────────────────────────────────────────────────
-- Come per il resto del portale, il socio scrive solo attraverso funzioni.

-- Sono iscritto agli avvisi vento?
create or replace function portale.vento_iscritto()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from portale.vento_iscritti
     where member_id = portale.socio_member_id()
  );
$$;

revoke all on function portale.vento_iscritto() from public;
grant execute on function portale.vento_iscritto() to authenticated;

-- Accendo o spengo la spunta. Ritorna lo stato finale.
create or replace function portale.vento_imposta(p_attivo boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
begin
  v_member_id := portale.socio_member_id();
  if v_member_id is null then
    return false;
  end if;

  if p_attivo then
    insert into portale.vento_iscritti(member_id)
    values (v_member_id)
    on conflict (member_id) do nothing;
  else
    delete from portale.vento_iscritti where member_id = v_member_id;
  end if;

  return p_attivo;
end;
$$;

revoke all on function portale.vento_imposta(boolean) from public;
grant execute on function portale.vento_imposta(boolean) to authenticated;
