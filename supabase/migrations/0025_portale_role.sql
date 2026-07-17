-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0025
-- Portale soci: aggiunta del ruolo 'socio'
-- ============================================================================
-- ATTENZIONE: questa migration contiene SOLO l'aggiunta del valore all'enum.
-- Postgres non permette di usare un nuovo valore di enum nella stessa
-- transazione in cui viene aggiunto, quindi tutto il resto sta in 0026.
-- Non accorpare i due file.
-- ============================================================================

alter type user_role add value if not exists 'socio';
