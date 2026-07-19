-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0032
-- Il profilo del socio espone i dati anagrafici.
-- ============================================================================
-- La vista portale.mio_profilo mostrava solo nome e scadenze. Per la sezione
-- anagrafica del portale servono anche data di nascita, email e telefono.
-- Le colonne si aggiungono IN CODA: create or replace e' sicuro.
-- Resta filtrata sul socio loggato: ognuno vede solo se stesso.
-- ============================================================================

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
  m.medical_cert_expires_at  as certificato_scade_il,
  m.birth_date               as data_nascita,
  m.birth_place              as luogo_nascita,
  m.email,
  m.phone                    as telefono
from members m
where m.id = portale.socio_member_id();

grant select on portale.mio_profilo to authenticated;
