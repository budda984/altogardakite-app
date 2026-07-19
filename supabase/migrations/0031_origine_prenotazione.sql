-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0031
-- Origine della prenotazione: dal portale o dalla segreteria.
-- ============================================================================
-- PERCHE'
--   Il planning deve distinguere le richieste dei soci (che aspettano un
--   si' o un no) dalle prenotazioni inserite dalla segreteria (che sono
--   gia' decise per definizione: le hai messe tu).
--   created_by non basta: e' un uuid ambiguo. Serve un campo esplicito.
--
-- REGOLA che ne deriva, usata dall'API del planning:
--   "lavorabile nel planner" = source = 'staff'
--                              OPPURE (source = 'portale' AND accepted_at not null)
--   Una richiesta dal portale senza risposta NON deve poter finire in
--   un'uscita per sbaglio: prima si accetta, poi si pianifica.
-- ============================================================================

alter table bookings
  add column if not exists source text not null default 'staff'
  check (source in ('staff', 'portale'));

comment on column bookings.source is
  'staff = inserita dalla segreteria (gia'' decisa). portale = richiesta del socio, va accettata prima di finire in un''uscita.';

-- Le richieste gia' esistenti arrivate dal portale: le riconosciamo perche'
-- il loro created_by e' un profilo con ruolo socio.
update bookings b
   set source = 'portale'
  from profiles p
 where p.id = b.created_by
   and p.role = 'socio'
   and b.source = 'staff';

-- D'ora in poi ci pensa la funzione: chi passa da richiedi_posto() e' portale.
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

  v_attesa := posti_liberi(p_giorno, p_fascia) <= 0;

  insert into bookings (
    member_id, booking_date, session_template_id,
    preferred_discipline, notes, status, created_by, is_waitlist, source
  ) values (
    v_member_id, p_giorno, v_template_id,
    p_disciplina, p_note, 'pending', auth.uid(), v_attesa, 'portale'
  ) returning id into v_booking_id;

  return v_booking_id;
end;
$$;

grant execute on function portale.richiedi_posto(date, text, lift_discipline, text) to authenticated;

-- La vista della coda espone anche l'origine (utile per debug e filtri futuri)
-- e non cambia struttura: source si aggiunge in coda.
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
       and b2.source = 'portale'
  ) as altre_richieste_sulla_fascia,
  b.session_template_id,
  b.source
from bookings b
join members m           on m.id = b.member_id
join session_templates st on st.id = b.session_template_id
where b.status = 'pending'
  and b.accepted_at is null
  and b.refused_at is null
  and b.source = 'portale'
order by b.booking_date, b.created_at;

grant select on bookings_da_rispondere to authenticated;


-- ----------------------------------------------------------------------------
-- bookings_with_member: la vista che alimenta il planning.
-- Aggiunge in coda source, accepted_at, is_waitlist, refused_at: cosi' il
-- planner puo' distinguere "richiesta da approvare" da "prenotazione
-- lavorabile" senza cambiare l'API in modo invasivo.
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
  st.default_return_time,
  b.source,
  b.accepted_at,
  b.refused_at,
  b.is_waitlist
from bookings b
join members m on m.id = b.member_id
join session_templates st on st.id = b.session_template_id;

grant select on bookings_with_member to authenticated;
