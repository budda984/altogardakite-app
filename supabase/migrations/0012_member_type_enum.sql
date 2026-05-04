-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0012
-- FASE 1: aggiunta enum member_type (committare prima di 0012b)
-- ============================================================================

create type member_type as enum ('sostenitore', 'normale', 'con_lift');
