-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0018
-- Aggiunge il telefono del socio alla vista bookings_with_member,
-- necessario per la funzione "avvisa i prenotati via WhatsApp".
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
