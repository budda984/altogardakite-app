-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0035
-- Permessi mancanti per l'invio delle push lato server.
-- ============================================================================
-- L'endpoint /api/push/invia gira con la service role key. La service role
-- scavalca RLS, ma NON aveva il 'usage' sullo schema portale (la 0026 lo
-- concedeva solo agli utenti autenticati). Senza, ogni lettura della coda
-- falliva con "permission denied for schema portale".
-- ============================================================================

grant usage on schema portale to service_role;

grant execute on function portale.push_da_inviare(int) to service_role;
grant execute on function portale.push_esito(bigint, boolean, text) to service_role;
grant execute on function portale.push_rimuovi_iscrizione(uuid) to service_role;
