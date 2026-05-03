-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0011
-- FASE 1: aggiunge il valore 'annullata' all'enum outing_status
--
-- IMPORTANTE: questo file va eseguito DA SOLO. Postgres non permette di usare
-- un nuovo valore enum nella stessa transazione in cui viene aggiunto.
-- Dopo questo file, eseguire 0011b_*.sql
-- ============================================================================

alter type outing_status add value if not exists 'annullata';
