-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0013
-- Tabella prenotazioni: lista soci che vogliono partecipare a uno slot
-- orario, prima della creazione uscita da parte dell'istruttore.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ENUM stato prenotazione
-- ----------------------------------------------------------------------------
do $$ begin
  create type booking_status as enum ('pending', 'assigned', 'cancelled');
exception
  when duplicate_object then null;
end $$;

-- ----------------------------------------------------------------------------
-- TABLE bookings
-- ----------------------------------------------------------------------------
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,

  -- Data e slot
  booking_date date not null,
  session_template_id uuid not null references session_templates(id) on delete cascade,

  -- Preferenze (opzionali, l'istruttore decidera l'effettivo participation_type)
  preferred_discipline lift_discipline,
  notes text,

  -- Stato
  status booking_status not null default 'pending',

  -- Quando assegnata, riferimento all'uscita
  outing_id uuid references outings(id) on delete set null,
  participant_id uuid references outing_participants(id) on delete set null,

  -- Audit
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancellation_reason text,

  -- Vincolo: un socio non puo' avere due prenotazioni pending sullo stesso
  -- slot dello stesso giorno
  unique (member_id, booking_date, session_template_id, status)
    deferrable initially deferred
);

create index if not exists idx_bookings_date_slot on bookings(booking_date, session_template_id);
create index if not exists idx_bookings_status on bookings(status);
create index if not exists idx_bookings_member on bookings(member_id);

-- ----------------------------------------------------------------------------
-- RLS policies
-- ----------------------------------------------------------------------------
alter table bookings enable row level security;

drop policy if exists "staff_all_bookings" on bookings;
create policy "staff_all_bookings"
  on bookings
  for all
  to authenticated
  using (is_active_staff())
  with check (is_active_staff());

-- ----------------------------------------------------------------------------
-- FUNCTION create_outing_from_bookings
-- Crea un'uscita assegnando un gruppo di prenotazioni come partecipanti.
-- Le prenotazioni passate vengono marcate come 'assigned' e collegate
-- all'uscita.
-- ----------------------------------------------------------------------------
create or replace function create_outing_from_bookings(
  p_booking_ids uuid[],
  p_boat_id uuid,
  p_outing_date date,
  p_session_template_id uuid,
  p_discipline lift_discipline,
  p_departure_time time,
  p_return_time time,
  p_wind_session wind_session,
  p_weather_notes text,
  p_notes text,
  p_instructor_ids uuid[],
  p_created_by uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_outing_id uuid;
  v_booking record;
  v_participant_id uuid;
  v_count_participants integer := 0;
begin
  -- Verifica preconditions
  if array_length(p_booking_ids, 1) is null then
    raise exception 'Nessuna prenotazione selezionata';
  end if;
  if p_boat_id is null then
    raise exception 'Barca obbligatoria';
  end if;

  -- Verifica che tutte le prenotazioni siano pending e dello stesso giorno/slot
  perform 1
    from bookings
    where id = any(p_booking_ids)
      and (status != 'pending'
        or booking_date != p_outing_date
        or session_template_id != p_session_template_id);
  if found then
    raise exception 'Una o piu prenotazioni non sono pending o non corrispondono al giorno/slot dell uscita';
  end if;

  -- Crea l'uscita
  insert into outings (
    outing_date, boat_id, session_template_id, discipline,
    wind_session, departure_time, return_time,
    weather_notes, notes, status
  ) values (
    p_outing_date, p_boat_id, p_session_template_id, p_discipline,
    p_wind_session, p_departure_time, p_return_time,
    p_weather_notes, p_notes, 'bozza'
  ) returning id into v_outing_id;

  -- Aggiungi istruttori
  if array_length(p_instructor_ids, 1) > 0 then
    insert into outing_instructors (outing_id, instructor_id)
    select v_outing_id, unnest(p_instructor_ids);
  end if;

  -- Per ogni booking: crea participant + aggiorna booking
  for v_booking in
    select b.*, m.first_name, m.last_name
      from bookings b
      join members m on m.id = b.member_id
      where b.id = any(p_booking_ids)
      order by m.last_name, m.first_name
  loop
    -- Default participation_type basato sulla disciplina prenotata o uscita
    insert into outing_participants (
      outing_id, member_id, participation_type, rental_type, notes
    ) values (
      v_outing_id, v_booking.member_id,
      'lift_semplice',  -- default modificabile dopo
      'nessuno',
      v_booking.notes
    ) returning id into v_participant_id;

    -- Aggiorna prenotazione
    update bookings
      set status = 'assigned',
          outing_id = v_outing_id,
          participant_id = v_participant_id
      where id = v_booking.id;

    v_count_participants := v_count_participants + 1;
  end loop;

  return v_outing_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- VIEW: prenotazioni con info socio per il giorno (helper)
-- ----------------------------------------------------------------------------
create or replace view bookings_with_member as
select
  b.id,
  b.member_id,
  b.booking_date,
  b.session_template_id,
  b.preferred_discipline,
  b.notes,
  b.status,
  b.outing_id,
  b.created_at,
  m.first_name,
  m.last_name,
  m.membership_number,
  m.member_type,
  m.expires_at,
  m.medical_cert_received,
  m.medical_cert_expires_at,
  st.name as template_name,
  st.wind_session as template_wind_session,
  st.default_departure_time,
  st.default_return_time
from bookings b
join members m on m.id = b.member_id
join session_templates st on st.id = b.session_template_id;
