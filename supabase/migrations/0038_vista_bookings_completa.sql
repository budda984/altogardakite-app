-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0038
-- Ripristino colonne perse dalla vista bookings_with_member.
-- ============================================================================
-- La 0031, ridefinendo la vista per aggiungere source/accepted_at/refused_at,
-- ha perso tre colonne che la 0021 aveva:
--   - created_by / created_by_name  -> "Inserito da Nome il data" sulle card
--   - phone                         -> l'Avvisa via WhatsApp del planning
-- Questa migration ricrea la vista con l'unione completa delle due:
-- tutte le colonne della 0021 + le aggiunte della 0031. Nessuna rimozione.
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
  st.default_return_time,
  b.source,
  b.accepted_at,
  b.refused_at
from bookings b
join members m on m.id = b.member_id
join session_templates st on st.id = b.session_template_id
left join profiles p on p.id = b.created_by;

grant select on bookings_with_member to authenticated;
