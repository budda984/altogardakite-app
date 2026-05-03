-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0010
-- - flag is_foreign sui soci (stranieri senza CF italiano)
-- - foreign_id_doc per documento di riconoscimento alternativo
-- ============================================================================

alter table members
  add column if not exists is_foreign boolean not null default false,
  add column if not exists foreign_id_doc text;

comment on column members.is_foreign is
  'Se true: socio straniero senza codice fiscale italiano. Il campo fiscal_code puo essere vuoto.';
comment on column members.foreign_id_doc is
  'Numero documento di identita per soci stranieri (passaporto, carta identita straniera, ecc.).';
