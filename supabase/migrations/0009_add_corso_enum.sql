-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0009
-- FASE 1 (separata): aggiunta valore 'corso' all'enum lift_discipline
--
-- IMPORTANTE: questo file va eseguito DA SOLO e committato (Postgres non
-- permette di usare un nuovo valore enum nella stessa transazione in cui
-- viene aggiunto). Dopo l'esecuzione di questo file, eseguire 0009b_*.sql
-- ============================================================================

alter type lift_discipline add value if not exists 'corso';
