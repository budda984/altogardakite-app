-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0021
-- Espone nella vista delle prenotazioni chi ha inserito la prenotazione
-- (display_name del profilo) oltre alla data di creazione, gia presente.
-- ============================================================================

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
  b.created_by,
  p.display_name as created_by_name,
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
join session_templates st on st.id = b.session_template_id
left join profiles p on p.id = b.created_by;
