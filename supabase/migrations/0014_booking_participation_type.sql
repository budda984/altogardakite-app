-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0014
-- Aggiunge tipo partecipazione alle prenotazioni:
-- corso / lift_supervisionato / lift_semplice
-- Viene poi propagato a outing_participants quando l'istruttore crea l'uscita.
-- ============================================================================

alter table bookings
  add column if not exists participation_type participation_type not null default 'lift_semplice';

comment on column bookings.participation_type is
  'Tipo di partecipazione richiesto dal socio: corso, lift_supervisionato, lift_semplice';

-- ----------------------------------------------------------------------------
-- Aggiorna create_outing_from_bookings: usa il participation_type del booking
-- invece del default 'lift_semplice'
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
  if array_length(p_booking_ids, 1) is null then
    raise exception 'Nessuna prenotazione selezionata';
  end if;
  if p_boat_id is null then
    raise exception 'Barca obbligatoria';
  end if;

  perform 1
    from bookings
    where id = any(p_booking_ids)
      and (status != 'pending'
        or booking_date != p_outing_date
        or session_template_id != p_session_template_id);
  if found then
    raise exception 'Una o piu prenotazioni non sono pending o non corrispondono al giorno/slot dell uscita';
  end if;

  insert into outings (
    outing_date, boat_id, session_template_id, discipline,
    wind_session, departure_time, return_time,
    weather_notes, notes, status
  ) values (
    p_outing_date, p_boat_id, p_session_template_id, p_discipline,
    p_wind_session, p_departure_time, p_return_time,
    p_weather_notes, p_notes, 'bozza'
  ) returning id into v_outing_id;

  if array_length(p_instructor_ids, 1) > 0 then
    insert into outing_instructors (outing_id, instructor_id)
    select v_outing_id, unnest(p_instructor_ids);
  end if;

  for v_booking in
    select b.*, m.first_name, m.last_name
      from bookings b
      join members m on m.id = b.member_id
      where b.id = any(p_booking_ids)
      order by m.last_name, m.first_name
  loop
    -- Usa il participation_type del booking
    insert into outing_participants (
      outing_id, member_id, participation_type, rental_type, notes
    ) values (
      v_outing_id, v_booking.member_id,
      v_booking.participation_type,
      'nessuno',
      v_booking.notes
    ) returning id into v_participant_id;

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
-- Aggiorna view bookings_with_member per includere participation_type
-- (drop + create perche' la nuova colonna va inserita in posizione intermedia)
-- ----------------------------------------------------------------------------
drop view if exists bookings_with_member;

create view bookings_with_member as
select
  b.id,
  b.member_id,
  b.booking_date,
  b.session_template_id,
  b.preferred_discipline,
  b.participation_type,
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
