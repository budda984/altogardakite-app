-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0037
-- Lettura di push_iscrizioni per la service role.
-- ============================================================================
-- Il gestionale, dopo "Notifica nel portale", verifica chi ha le push attive
-- leggendo direttamente portale.push_iscrizioni con la service role key.
-- La 0035 aveva concesso lo schema e le funzioni di invio, ma non il SELECT
-- sulla tabella: la verifica falliva con "permission denied for table
-- push_iscrizioni". Un grant di sola lettura sistema la cosa.
-- ============================================================================

grant select on portale.push_iscrizioni to service_role;
