-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0030
-- Capienza della flotta e lista d'attesa automatica.
-- ============================================================================
-- IL MODELLO, come descritto da Andrea:
--   Le barche ci sono sempre. La capienza di una fascia e' la somma delle
--   barche attive: Lomac 8 + Nuova Jolly 5 + Pontoon 12 = 25.
--   Se una barca viene segnata assente, la capienza cala di conseguenza.
--   Niente calendario da mantenere: solo le eccezioni.
--
-- UNA SCELTA IMPORTANTE: la capienza e' per FASCIA, non per session_template.
--   Peler (kite, 08:00) e Wingfoil mattina (08:30) escono con le STESSE
--   barche. Contarli separatamente vorrebbe dire vendere 25 posti al kite e
--   altri 25 al wing sulla stessa flotta. Quindi mattina = peler,
--   pomeriggio = ora + ora_serale, e i posti si contano insieme.
--
-- Additiva. Il planner e create_outing_from_bookings() non cambiano.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. CAPIENZA DELLE BARCHE
-- La colonna boats.capacity esiste dalla 0001 ma non e' mai stata popolata.
-- ----------------------------------------------------------------------------
update boats set capacity = 8  where lower(name) = 'lomac'       and capacity is null;
update boats set capacity = 5  where lower(name) = 'nuova jolly' and capacity is null;
update boats set capacity = 12 where lower(name) = 'pontoon'     and capacity is null;

do $$
declare v_senza int;
begin
  select count(*) into v_senza from boats where active = true and capacity is null;
  if v_senza > 0 then
    raise warning 'Ci sono % barche attive senza capienza: non contano nel totale. Sistemale con: update boats set capacity = N where name = ...', v_senza;
  end if;
end $$;

alter table boats add constraint chk_capacity_positiva
  check (capacity is null or capacity > 0) not valid;


-- ----------------------------------------------------------------------------
-- 2. ASSENZE DELLE BARCHE
-- Stesso identico modello delle assenze istruttori (0022): un giorno, e
-- opzionalmente una sola fascia. Manutenzione, guasto, fuori servizio.
-- ----------------------------------------------------------------------------
create table if not exists boat_absences (
  id uuid primary key default gen_random_uuid(),
  boat_id uuid not null references boats(id) on delete cascade,
  absence_date date not null,
  -- null = tutto il giorno. Altrimenti solo quella fascia.
  wind_session wind_session,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_boat_absences_date on boat_absences(absence_date);
-- Due indici parziali invece di uno con coalesce: il cast di un enum a testo
-- non e' immutabile e Postgres non lo accetta in un indice.
create unique index if not exists idx_boat_absences_giorno_intero
  on boat_absences(boat_id, absence_date) where wind_session is null;
create unique index if not exists idx_boat_absences_per_fascia
  on boat_absences(boat_id, absence_date, wind_session) where wind_session is not null;

alter table boat_absences enable row level security;

create policy "staff_all_boat_absences" on boat_absences
  for all to authenticated
  using (is_active_staff()) with check (is_active_staff());

grant select, insert, update, delete on boat_absences to authenticated;


-- ----------------------------------------------------------------------------
-- 3. LE FASCE
-- Una fascia raggruppa piu' session_template. Qui la regola sta in un posto
-- solo, cosi' non si sfilaccia in giro per il codice.
-- ----------------------------------------------------------------------------
create or replace function fascia_di(p_ws wind_session)
returns text
language sql
immutable
as $$ select case when p_ws = 'peler' then 'mattina' else 'pomeriggio' end $$;

create or replace function sessioni_della_fascia(p_fascia text)
returns wind_session[]
language sql
immutable
as $$
  select case when p_fascia = 'mattina'
              then array['peler']::wind_session[]
              else array['ora', 'ora_serale']::wind_session[]
         end
$$;


-- ----------------------------------------------------------------------------
-- 4. CAPIENZA DI UNA FASCIA IN UN GIORNO
-- Somma delle barche attive, meno quelle assenti quel giorno su quella fascia.
-- ----------------------------------------------------------------------------
create or replace function capienza_fascia(p_giorno date, p_fascia text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(b.capacity), 0)::integer
    from boats b
   where b.active = true
     and b.capacity is not null
     and not exists (
       select 1 from boat_absences a
        where a.boat_id = b.id
          and a.absence_date = p_giorno
          and (a.wind_session is null
               or a.wind_session = any(sessioni_della_fascia(p_fascia)))
     );
$$;

-- Posti gia' impegnati: chi ha avuto un si (accepted) e chi e' gia' in
-- un'uscita (assigned). Le richieste ancora senza risposta NON occupano un
-- posto: il posto lo tiene la segreteria quando accetta.
-- La lista d'attesa non conta: e' fuori dalla capienza per definizione.
create or replace function posti_impegnati(p_giorno date, p_fascia text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from bookings b
    join session_templates st on st.id = b.session_template_id
   where b.booking_date = p_giorno
     and st.wind_session = any(sessioni_della_fascia(p_fascia))
     and b.is_waitlist = false
     and b.refused_at is null
     and (b.status = 'assigned' or (b.status = 'pending' and b.accepted_at is not null));
$$;

create or replace function posti_liberi(p_giorno date, p_fascia text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(capienza_fascia(p_giorno, p_fascia) - posti_impegnati(p_giorno, p_fascia), 0);
$$;

grant execute on function capienza_fascia(date, text) to authenticated;
grant execute on function posti_impegnati(date, text) to authenticated;
grant execute on function posti_liberi(date, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 5. LA RICHIESTA DEL SOCIO CONOSCE LA CAPIENZA
-- Se la fascia e' piena, la richiesta nasce gia' in lista d'attesa e il socio
-- lo sa subito, invece di scoprirlo il giorno dopo.
-- ----------------------------------------------------------------------------
create or replace function portale.richiedi_posto(
  p_giorno     date,
  p_fascia     text,
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
  v_attesa      boolean;
begin
  v_member_id := portale.socio_member_id();
  if v_member_id is null then
    raise exception 'Non risulti collegato a nessuna scheda socio.' using errcode = '42501';
  end if;

  if p_fascia not in ('mattina', 'pomeriggio') then
    raise exception 'Fascia non valida: %', p_fascia;
  end if;

  if p_giorno < current_date then
    raise exception 'Non puoi prenotare un giorno passato.';
  end if;

  select expires_at into v_tessera from members where id = v_member_id;
  if v_tessera is not null and v_tessera < p_giorno then
    raise exception 'La tua tessera scade il %. Rinnovala in segreteria.', v_tessera;
  end if;

  select st.id into v_template_id
    from session_templates st
   where st.is_active = true
     and st.discipline = p_disciplina
     and st.wind_session = any(sessioni_della_fascia(p_fascia))
   order by st.sort_order
   limit 1;

  if v_template_id is null then
    raise exception 'Nessuna sessione % disponibile per %.', p_fascia, p_disciplina;
  end if;

  select id into v_booking_id
    from bookings
   where member_id = v_member_id
     and booking_date = p_giorno
     and session_template_id = v_template_id
     and status = 'pending';
  if found then
    return v_booking_id;
  end if;

  -- La novita': se non ci sono posti, si entra in lista d'attesa.
  v_attesa := posti_liberi(p_giorno, p_fascia) <= 0;

  insert into bookings (
    member_id, booking_date, session_template_id,
    preferred_discipline, notes, status, created_by, is_waitlist
  ) values (
    v_member_id, p_giorno, v_template_id,
    p_disciplina, p_note, 'pending', auth.uid(), v_attesa
  ) returning id into v_booking_id;

  return v_booking_id;
end;
$$;

grant execute on function portale.richiedi_posto(date, text, lift_discipline, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 6. IL PORTALE VEDE LA DISPONIBILITA'
-- Il calendario del socio puo' finalmente dire "al completo" senza mentire.
-- ----------------------------------------------------------------------------
create or replace function portale.disponibilita(p_da date, p_a date)
returns table (giorno date, fascia text, capienza integer, liberi integer)
language sql
stable
security definer
set search_path = public
as $$
  select g::date,
         f.fascia,
         capienza_fascia(g::date, f.fascia),
         posti_liberi(g::date, f.fascia)
    from generate_series(p_da, p_a, interval '1 day') g
    cross join (values ('mattina'), ('pomeriggio')) as f(fascia)
   where portale.socio_member_id() is not null;
$$;

grant execute on function portale.disponibilita(date, date) to authenticated;


-- ----------------------------------------------------------------------------
-- 7. LA SEGRETERIA VEDE I POSTI MENTRE DECIDE
-- ----------------------------------------------------------------------------
drop view if exists bookings_da_rispondere;

create view bookings_da_rispondere as
select
  b.id,
  b.booking_date,
  b.created_at,
  b.notes,
  b.is_waitlist,
  b.preferred_discipline,
  m.id            as member_id,
  m.first_name,
  m.last_name,
  m.phone,
  m.membership_number,
  m.member_type,
  m.expires_at              as tessera_scade_il,
  (m.expires_at is not null and m.expires_at < b.booking_date) as tessera_scaduta,
  m.medical_cert_expires_at as certificato_scade_il,
  (m.medical_cert_expires_at is null
    or m.medical_cert_expires_at < b.booking_date)             as certificato_non_valido,
  st.name                   as template_name,
  st.wind_session,
  st.default_departure_time,
  fascia_di(st.wind_session) as fascia,
  (
    select greatest(p.lifts_total - p.lifts_used, 0)
      from packages p
     where p.member_id = m.id
       and p.is_subscription = false
       and p.discipline = coalesce(b.preferred_discipline, st.discipline)
       and p.is_exhausted = false
     order by (p.lifts_total - p.lifts_used) desc
     limit 1
  ) as lift_residui,
  has_active_subscription(m.id, coalesce(b.preferred_discipline, st.discipline)) as ha_abbonamento,
  capienza_fascia(b.booking_date, fascia_di(st.wind_session)) as capienza,
  posti_impegnati(b.booking_date, fascia_di(st.wind_session)) as posti_impegnati,
  posti_liberi(b.booking_date, fascia_di(st.wind_session))    as posti_liberi,
  (
    select count(*)
      from bookings b2
      join session_templates st2 on st2.id = b2.session_template_id
     where b2.booking_date = b.booking_date
       and st2.wind_session = any(sessioni_della_fascia(fascia_di(st.wind_session)))
       and b2.status = 'pending'
       and b2.accepted_at is null
       and b2.refused_at is null
  ) as altre_richieste_sulla_fascia
from bookings b
join members m           on m.id = b.member_id
join session_templates st on st.id = b.session_template_id
where b.status = 'pending'
  and b.accepted_at is null
  and b.refused_at is null
order by b.booking_date, b.created_at;

grant select on bookings_da_rispondere to authenticated;
