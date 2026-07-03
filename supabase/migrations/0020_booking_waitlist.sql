-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0020
-- Lista d'attesa: aggiunge un flag alle prenotazioni.
-- Una prenotazione in lista d'attesa resta 'pending' ma con is_waitlist = true;
-- non viene inclusa nel planner ne' nella creazione uscite finche' non la
-- si sposta manualmente tra i confermati.
-- ============================================================================

alter table bookings
  add column if not exists is_waitlist boolean not null default false;

-- Ricrea la vista per esporre il nuovo campo
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
  b.is_waitlist,
  b.outing_id,
  b.created_at,
  m.first_name,
  m.last_name,
  m.membership_number,
  m.member_type,
  m.phone,
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
