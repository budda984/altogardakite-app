-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0009
-- - aggiunta disciplina 'corso' per pacchetti lezioni
-- - servizi listino: lezione singola + pacchetti 5/10 lezioni
-- - flag iscrizione cartacea sui soci
-- - close_outing aggiornata per gestire participation_type = 'corso'
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ENUM lift_discipline: aggiungiamo 'corso'
-- ----------------------------------------------------------------------------
alter type lift_discipline add value if not exists 'corso';

-- ----------------------------------------------------------------------------
-- FLAG iscrizione cartacea sui soci
-- ----------------------------------------------------------------------------
alter table members
  add column if not exists paper_form_signed boolean not null default false;

comment on column members.paper_form_signed is
  'Se true: il cliente ha firmato il modulo cartaceo, quindi le dichiarazioni e firme digitali non sono richieste.';

-- ----------------------------------------------------------------------------
-- SERVIZI: aggiungi lezione singola + pacchetti corsi
-- (placeholder di prezzo, modificabili da /servizi)
-- ----------------------------------------------------------------------------
insert into services (slug, name, category, unit_price, included_lifts, discipline, is_subscription, description, sort_order, is_active)
values
  ('lezione_singola', 'Lezione singola di corso', 'iniziazione', 60.00, 1, 'corso', false,
   'Una singola lezione del corso (per chi non ha pacchetto)', 100, true),
  ('pacchetto_corso_5', 'Pacchetto corso 5 lezioni', 'iniziazione', 280.00, 5, 'corso', false,
   '5 lezioni di corso, scalate una a una', 110, true),
  ('pacchetto_corso_10', 'Pacchetto corso 10 lezioni', 'iniziazione', 520.00, 10, 'corso', false,
   '10 lezioni di corso, scalate una a una', 120, true)
on conflict (slug) do nothing;
