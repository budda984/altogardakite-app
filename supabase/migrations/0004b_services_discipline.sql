-- ============================================================================
-- Aggiunge la disciplina ai servizi e aggiorna il seed
-- Da eseguire dopo 0004_wallet_and_movements.sql
-- ============================================================================

-- Aggiungi colonna discipline ai servizi (per sapere a quale "valuta" lift appartengono)
alter table services
  add column if not exists discipline lift_discipline not null default 'altro';

-- Aggiorna i servizi esistenti con la disciplina corretta
update services set discipline = 'kite' where slug in (
  'lift_singolo_kw',
  'lift_singolo_under18_kw',
  'pacchetto_10_lift_kw',
  'pacchetto_10_lift_under18_kw',
  'lift_assistito',
  'pacchetto_10_lift_assistito_under18_over65',
  'iniziazione_kw_wf_adattato',
  'stagionale_kite_infrasettimanale',
  'stagionale_kite_full',
  'noleggio_kite_tavola',
  'noleggio_kite',
  'noleggio_tavola',
  'combo_1lift_kite_tavola',
  'combo_5lift_kite_tavola',
  'combo_10lift_kite_tavola'
);

update services set discipline = 'wingfoil' where slug in (
  'noleggio_wingfoil',
  'combo_1lift_wingfoil',
  'combo_5lift_wingfoil',
  'combo_10lift_wingfoil'
);

update services set discipline = 'sit_kite' where slug in (
  'iniziazione_sit_kite',
  'pacchetto_10_lift_assistito_sit_wf'
);
