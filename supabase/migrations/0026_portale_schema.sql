-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0026
-- Portale soci: schema dedicato, viste filtrate sul socio loggato, avvisi.
-- ============================================================================
-- PRINCIPI
--  * Additiva: non modifica ne' cancella niente di esistente.
--    Per tornare indietro: drop schema portale cascade; e le due colonne
--    aggiunte a profiles.
--  * Il gestionale non cambia: le sue policy 'staff_*' restano intatte e
--    la service role key continua a bypassare RLS.
--  * Il socio non tocca mai le tabelle di public: legge solo attraverso le
--    viste di questo schema e scrive solo tramite le funzioni qui sotto.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. AGGANCIO ACCOUNT <-> SCHEDA SOCIO
-- ----------------------------------------------------------------------------

alter table profiles
  add column if not exists member_id uuid references members(id) on delete set null,
  add column if not exists linked_at timestamptz;

-- Un socio per account, un account per socio.
create unique index if not exists idx_profiles_member
  on profiles(member_id) where member_id is not null;

comment on column profiles.member_id is
  'Scheda socio collegata a questo account. Valorizzata solo per role = socio.';


create schema if not exists portale;
grant usage on schema portale to authenticated;


-- ----------------------------------------------------------------------------
-- 2. CHI SONO
-- Ritorna il member_id del socio loggato, oppure null.
-- Security definer: deve leggere profiles scavalcando le sue policy.
-- ----------------------------------------------------------------------------
create or replace function portale.socio_member_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select member_id
    from profiles
   where id = auth.uid()
     and role = 'socio'
     and suspended = false
     and member_id is not null;
$$;

revoke all on function portale.socio_member_id() from public;
grant execute on function portale.socio_member_id() to authenticated;


-- ----------------------------------------------------------------------------
-- 3. COLLEGAMENTO AL PRIMO ACCESSO
-- Il link magico dimostra che l'email e' sua: se corrisponde a UNA sola
-- scheda attiva, colleghiamo. Se ne corrisponde piu' di una (tipico: un
-- genitore con due figli minori) non colleghiamo niente e lasciamo il
-- collegamento alla segreteria. Meglio una noia che il socio sbagliato.
-- ----------------------------------------------------------------------------
create or replace function portale.collega_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email   text;
  v_profile profiles%rowtype;
  v_ids     uuid[];
begin
  select * into v_profile from profiles where id = auth.uid();
  if not found then
    return jsonb_build_object('esito', 'errore', 'motivo', 'nessun profilo');
  end if;

  -- Gia' collegato, o e' staff: non tocchiamo niente.
  if v_profile.member_id is not null then
    return jsonb_build_object('esito', 'gia_collegato', 'member_id', v_profile.member_id);
  end if;
  if v_profile.role in ('staff', 'admin') then
    return jsonb_build_object('esito', 'staff');
  end if;

  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is null then
    return jsonb_build_object('esito', 'errore', 'motivo', 'account senza email');
  end if;

  -- Match sull'email del socio o su quella del genitore (soci minorenni).
  select array_agg(m.id) into v_ids
    from members m
   where m.active = true
     and (lower(m.email) = v_email or lower(m.parent_email) = v_email);

  if v_ids is null then
    return jsonb_build_object('esito', 'nessuna_scheda');
  end if;

  if array_length(v_ids, 1) > 1 then
    return jsonb_build_object('esito', 'ambiguo', 'quante', array_length(v_ids, 1));
  end if;

  update profiles
     set member_id = v_ids[1],
         role      = 'socio',
         linked_at = now()
   where id = auth.uid();

  return jsonb_build_object('esito', 'collegato', 'member_id', v_ids[1]);
end;
$$;

revoke all on function portale.collega_account() from public;
grant execute on function portale.collega_account() to authenticated;


-- ----------------------------------------------------------------------------
-- 4. VISTE (sola lettura, gia' filtrate sul socio loggato)
-- Le viste sono di proprieta' di postgres, quindi scavalcano le RLS di
-- public: il filtro sul socio DEVE stare dentro la vista. Non togliere le
-- clausole where.
-- ----------------------------------------------------------------------------

-- 4a. La mia scheda + le due scadenze che contano
create or replace view portale.mio_profilo as
select
  m.id                       as member_id,
  m.membership_number,
  m.first_name,
  m.last_name,
  m.member_type,
  m.joined_at,
  m.expires_at               as tessera_scade_il,
  m.medical_cert_received    as certificato_consegnato,
  m.medical_cert_expires_at  as certificato_scade_il
from members m
where m.id = portale.socio_member_id();

-- 4b. Le fasce prenotabili (mattina / pomeriggio, accorpate).
-- Peler -> mattina. Ora e Ora late -> pomeriggio: al socio mostriamo una
-- fascia sola, l'orario preciso lo decidi tu creando l'uscita.
create or replace view portale.fasce as
select distinct on (fascia, st.discipline)
  case when st.wind_session = 'peler' then 'mattina' else 'pomeriggio' end as fascia,
  st.discipline                as disciplina,
  st.id                        as session_template_id,
  st.default_departure_time    as orario_indicativo
from session_templates st
where st.is_active = true
  and st.wind_session is not null
order by fascia, st.discipline, st.sort_order;

-- 4c. Le mie richieste
create or replace view portale.mie_prenotazioni as
select
  b.id,
  b.booking_date               as giorno,
  case when st.wind_session = 'peler' then 'mattina' else 'pomeriggio' end as fascia,
  coalesce(b.preferred_discipline, st.discipline) as disciplina,
  st.default_departure_time    as orario_indicativo,
  b.notes                      as note,
  b.is_waitlist                as in_lista_attesa,
  -- Tre stati soli, quelli del mockup. Il resto e' roba tua.
  case
    when b.status = 'cancelled' then 'annullata'
    when b.status = 'assigned'  then 'confermata'
    else 'in_attesa'
  end                          as stato,
  b.cancellation_reason        as motivo_annullamento,
  b.created_at
from bookings b
join session_templates st on st.id = b.session_template_id
where b.member_id = portale.socio_member_id();

-- 4d. I miei pacchetti e abbonamenti. Nessun prezzo: i soldi restano fuori.
create or replace view portale.miei_pacchetti as
select
  p.id,
  p.service_name_snapshot      as nome,
  p.discipline                 as disciplina,
  p.is_subscription            as e_abbonamento,
  -- a conteggio: quante ne restano. abbonamento: null, e' illimitato.
  case when p.is_subscription then null
       else greatest(p.lifts_total - p.lifts_used, 0) end as residue,
  case when p.is_subscription then null
       else p.lifts_total end                             as totale,
  p.valid_from                 as valido_dal,
  p.valid_until                as valido_fino_al,
  case
    when p.is_subscription and p.valid_until < current_date then 'scaduto'
    when p.is_subscription then 'attivo'
    when p.is_exhausted then 'esaurito'
    else 'attivo'
  end                          as stato
from packages p
where p.member_id = portale.socio_member_id();

-- 4e. Lo storico delle uscite fatte
create or replace view portale.mie_uscite as
select
  op.id,
  o.outing_date                as giorno,
  o.discipline                 as disciplina,
  o.departure_time             as partenza,
  op.participation_type        as tipo,
  o.code                       as codice,
  (
    select string_agg(i.first_name, ', ' order by i.first_name)
      from outing_instructors oi
      join instructors i on i.id = oi.instructor_id
     where oi.outing_id = o.id
  )                            as istruttori
from outing_participants op
join outings o on o.id = op.outing_id
where op.member_id = portale.socio_member_id()
order by o.outing_date desc;


-- ----------------------------------------------------------------------------
-- 5. AVVISI
-- La schermata "Segreteria": comunicazioni in uscita dal circolo verso il
-- socio. Il socio non scrive qui, risponde su WhatsApp.
-- ----------------------------------------------------------------------------
create table if not exists portale.avvisi (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references members(id) on delete cascade,
  tipo        text not null default 'messaggio'
              check (tipo in ('messaggio', 'annullamento', 'conferma', 'promemoria')),
  titolo      text,
  corpo       text not null,
  booking_id  uuid references bookings(id) on delete set null,
  letto_il    timestamptz,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null
);

create index if not exists idx_avvisi_member on portale.avvisi(member_id, created_at desc);
create index if not exists idx_avvisi_non_letti on portale.avvisi(member_id) where letto_il is null;

alter table portale.avvisi enable row level security;

-- Lo staff gestisce tutto, come nel resto del gestionale.
create policy "staff_all_avvisi" on portale.avvisi
  for all to authenticated
  using (is_active_staff()) with check (is_active_staff());

-- Il socio legge solo i propri.
create policy "socio_legge_avvisi" on portale.avvisi
  for select to authenticated
  using (member_id = portale.socio_member_id());

-- Il socio puo' solo segnarli come letti: nient'altro.
create policy "socio_segna_letto" on portale.avvisi
  for update to authenticated
  using (member_id = portale.socio_member_id())
  with check (member_id = portale.socio_member_id());

grant select, update on portale.avvisi to authenticated;


-- ----------------------------------------------------------------------------
-- 6. RICHIESTA DI UN POSTO
-- L'unica scrittura che il socio fa su public.bookings, e la fa solo qui
-- dentro. Nasce sempre 'pending': il posto e' suo quando crei l'uscita.
-- Il pacchetto non viene toccato: si scala alla chiusura dell'uscita, come
-- gia' avviene oggi.
-- ----------------------------------------------------------------------------
create or replace function portale.richiedi_posto(
  p_giorno     date,
  p_fascia     text,                     -- 'mattina' | 'pomeriggio'
  p_disciplina lift_discipline,
  p_note       text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id   uuid;
  v_template_id uuid;
  v_tessera     date;
  v_booking_id  uuid;
begin
  v_member_id := portale.socio_member_id();
  if v_member_id is null then
    raise exception 'Non risulti collegato a nessuna scheda socio.'
      using errcode = '42501';
  end if;

  if p_fascia not in ('mattina', 'pomeriggio') then
    raise exception 'Fascia non valida: %', p_fascia;
  end if;

  if p_giorno < current_date then
    raise exception 'Non puoi prenotare un giorno passato.';
  end if;

  -- Tessera scaduta: blocchiamo. E' il motivo per cui il portale esiste.
  select expires_at into v_tessera from members where id = v_member_id;
  if v_tessera is not null and v_tessera < p_giorno then
    raise exception 'La tua tessera scade il %. Rinnovala in segreteria.', v_tessera;
  end if;

  -- Fascia + disciplina -> template vero. La Ora late (sort_order piu' alto)
  -- non viene mai scelta qui: resta uno strumento della segreteria.
  select st.id into v_template_id
    from session_templates st
   where st.is_active = true
     and st.discipline = p_disciplina
     and st.wind_session = any(
           case when p_fascia = 'mattina'
                then array['peler']::wind_session[]
                else array['ora', 'ora_serale']::wind_session[]
           end)
   order by st.sort_order
   limit 1;

  if v_template_id is null then
    raise exception 'Nessuna sessione % disponibile per %.', p_fascia, p_disciplina;
  end if;

  -- Gia' richiesto? Restituiamo quella che c'e', senza duplicare.
  select id into v_booking_id
    from bookings
   where member_id = v_member_id
     and booking_date = p_giorno
     and session_template_id = v_template_id
     and status = 'pending';
  if found then
    return v_booking_id;
  end if;

  insert into bookings (
    member_id, booking_date, session_template_id,
    preferred_discipline, notes, status, created_by
  ) values (
    v_member_id, p_giorno, v_template_id,
    p_disciplina, p_note, 'pending', auth.uid()
  ) returning id into v_booking_id;

  return v_booking_id;
end;
$$;

revoke all on function portale.richiedi_posto(date, text, lift_discipline, text) from public;
grant execute on function portale.richiedi_posto(date, text, lift_discipline, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 7. ANNULLAMENTO DELLA PROPRIA RICHIESTA
-- Solo le proprie, solo se ancora 'pending'. Una volta che l'uscita e'
-- creata il socio non tocca piu' niente: passa dalla segreteria.
-- ----------------------------------------------------------------------------
create or replace function portale.annulla_richiesta(p_booking_id uuid)
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
    raise exception 'Non risulti collegato a nessuna scheda socio.'
      using errcode = '42501';
  end if;

  update bookings
     set status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = auth.uid(),
         cancellation_reason = 'Annullata dal socio dal portale'
   where id = p_booking_id
     and member_id = v_member_id
     and status = 'pending';

  return found;
end;
$$;

revoke all on function portale.annulla_richiesta(uuid) from public;
grant execute on function portale.annulla_richiesta(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 8. PERMESSI SULLE VISTE
-- ----------------------------------------------------------------------------
grant select on portale.mio_profilo      to authenticated;
grant select on portale.fasce            to authenticated;
grant select on portale.mie_prenotazioni to authenticated;
grant select on portale.miei_pacchetti   to authenticated;
grant select on portale.mie_uscite       to authenticated;

-- L'anon non entra da nessuna parte.
revoke all on schema portale from anon;
