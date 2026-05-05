-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0015
-- Fix vincolo univoco bookings:
-- - prima: unique(member_id, date, slot, status) → impediva storicizzazione
-- - dopo: indice parziale unique solo su status='pending' (stato vivo)
--   I bookings assigned/cancelled possono accumularsi senza vincoli.
-- ============================================================================

-- 1. Rimuovi il vecchio vincolo
alter table bookings drop constraint if exists bookings_member_id_booking_date_session_template_id_status_key;

-- 2. Indice univoco parziale: vale solo per i pending
create unique index if not exists idx_bookings_unique_pending
  on bookings(member_id, booking_date, session_template_id)
  where status = 'pending';

comment on index idx_bookings_unique_pending is
  'Un socio puo avere al massimo una prenotazione PENDING per giorno+slot. Le bookings assigned/cancelled sono storicizzate.';
