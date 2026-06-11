-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0017
-- Inserimento socio rapido: solo nome e cognome obbligatori.
-- birth_date e birth_place diventano nullable; tutti gli altri campi
-- anagrafici erano gia nullable.
-- ============================================================================

alter table members alter column birth_date drop not null;
alter table members alter column birth_place drop not null;
