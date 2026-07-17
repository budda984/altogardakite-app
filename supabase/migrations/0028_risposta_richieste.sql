-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0028
-- Risposta rapida alle richieste dei soci.
-- ============================================================================
-- IL PROBLEMA
--   Oggi 'pending' diventa 'assigned' solo quando create_outing_from_bookings()
--   fa nascere l'uscita dal planner, con barca e istruttore. Ma nel portale
--   abbiamo promesso al socio una risposta entro la sera prima. Fra la
--   richiesta e la creazione dell'uscita possono passare giorni.
--
-- LA SOLUZIONE
--   Nessun valore nuovo nell'enum: tre colonne.
--     accepted_at    -> il posto e' tenuto, l'uscita nascera' dopo
--     refused_at     -> risposta negativa, col motivo
--   `status` resta 'pending' quando accetti, cosi' il planner continua a
--   vedere la prenotazione e create_outing_from_bookings() non cambia di una riga.
--   Quando rifiuti, invece, mettiamo anche status = 'cancelled': la
--   prenotazione sparisce dal planner e libera il vincolo di unicita', cosi'
--   il socio puo' richiedere di nuovo dopo essersi sentito con la segreteria.
--
-- Additiva. Il gestionale attuale continua a funzionare identico.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. COLONNE
-- ----------------------------------------------------------------------------
alter table bookings
  add column if not exists accepted_at    timestamptz,
  add column if not exists accepted_by    uuid references auth.users(id) on delete set null,
  add column if not exists refused_at     timestamptz,
  add column if not exists refused_by     uuid references auth.users(id) on delete set null,
  add column if not exists refusal_reason text;

comment on column bookings.accepted_at is
  'Quando la segreteria ha tenuto il posto. status resta pending: l''uscita nasce dopo, dal planner.';
comment on column bookings.refused_at is
  'Quando la segreteria ha risposto no. Accompagnato da status = cancelled.';

do $$ begin
  alter table bookings add constraint chk_accettata_o_rifiutata
    check (not (accepted_at is not null and refused_at is not null));
exception when duplicate_object then null; end $$;

-- Le richieste ancora senza risposta: e' la coda di lavoro della segreteria.
create index if not exists idx_bookings_da_rispondere
  on bookings(booking_date)
  where status = 'pending' and accepted_at is null and refused_at is null;


-- ----------------------------------------------------------------------------
-- 2. VISTA PER LA SEGRETERIA
-- Tutto quello che serve per decidere in dieci secondi, senza aprire schede.
-- ----------------------------------------------------------------------------
create or replace view bookings_da_rispondere as
select
  b.id,
  b.booking_date,
  b.created_at,
  b.notes,
  b.is_waitlist,
  b.preferred_discipline,
  m.id            as member_id,
  m.first_name,
  m.last_name,
  m.phone,
  m.membership_number,
  m.member_type,
  m.expires_at              as tessera_scade_il,
  (m.expires_at is not null and m.expires_at < b.booking_date) as tessera_scaduta,
  m.medical_cert_expires_at as certificato_scade_il,
  (m.medical_cert_expires_at is null
    or m.medical_cert_expires_at < b.booking_date)             as certificato_non_valido,
  st.name                   as template_name,
  st.wind_session,
  st.default_departure_time,
  case when st.wind_session = 'peler' then 'mattina' else 'pomeriggio' end as fascia,
  -- Il pacchetto a conteggio piu' capiente per quella disciplina
  (
    select greatest(p.lifts_total - p.lifts_used, 0)
      from packages p
     where p.member_id = m.id
       and p.is_subscription = false
       and p.discipline = coalesce(b.preferred_discipline, st.discipline)
       and p.is_exhausted = false
     order by (p.lifts_total - p.lifts_used) desc
     limit 1
  ) as lift_residui,
  has_active_subscription(m.id, coalesce(b.preferred_discipline, st.discipline)) as ha_abbonamento,
  -- Quante richieste ci sono gia' su quel giorno e quella fascia
  (
    select count(*)
      from bookings b2
     where b2.booking_date = b.booking_date
       and b2.session_template_id = b.session_template_id
       and b2.status = 'pending'
       and b2.refused_at is null
  ) as richieste_sullo_slot
from bookings b
join members m           on m.id = b.member_id
join session_templates st on st.id = b.session_template_id
where b.status = 'pending'
  and b.accepted_at is null
  and b.refused_at is null
order by b.booking_date, b.created_at;

-- Esplicito: in Supabase i default privileges lo coprirebbero, ma meglio
-- non dipendere da una configurazione che potrebbe cambiare. La vista non
-- ha filtri sul socio, quindi la protegge la RLS di bookings/members: un
-- socio che ci provasse vedrebbe zero righe.
grant select on bookings_da_rispondere to authenticated;


-- ----------------------------------------------------------------------------
-- 3. RISPOSTA
-- Accetta o rifiuta, e scrive l'avviso al socio nello stesso colpo. Se
-- fossero due operazioni separate, prima o poi una delle due si dimentica.
-- ----------------------------------------------------------------------------
create or replace function rispondi_richiesta(
  p_booking_id uuid,
  p_accetta    boolean,
  p_motivo     text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_b       record;
  v_fascia  text;
  v_data    text;
begin
  if not is_active_staff() then
    raise exception 'Solo la segreteria puo rispondere alle richieste.'
      using errcode = '42501';
  end if;

  select b.*, st.wind_session, st.default_departure_time
    into v_b
    from bookings b
    join session_templates st on st.id = b.session_template_id
   where b.id = p_booking_id
     and b.status = 'pending'
     and b.accepted_at is null
     and b.refused_at is null;

  if not found then
    raise exception 'Richiesta inesistente o gia risposta.';
  end if;

  v_fascia := case when v_b.wind_session = 'peler' then 'mattina' else 'pomeriggio' end;
  v_data := to_char(v_b.booking_date, 'DD/MM/YYYY');

  if p_accetta then
    update bookings
       set accepted_at = now(),
           accepted_by = auth.uid()
     where id = p_booking_id;

    insert into portale.avvisi (member_id, tipo, titolo, corpo, booking_id, created_by)
    values (
      v_b.member_id, 'conferma', 'Posto tenuto',
      'La tua richiesta di ' || v_data || ' (' || v_fascia ||
      ') e stata accettata: il posto e tuo. Ti diciamo l''orario esatto quando decidiamo in base al vento.',
      p_booking_id, auth.uid()
    );
  else
    -- Rifiuto: anche 'cancelled', cosi' sparisce dal planner e il socio puo'
    -- richiedere di nuovo se vi mettete d'accordo diversamente.
    update bookings
       set refused_at = now(),
           refused_by = auth.uid(),
           refusal_reason = p_motivo,
           status = 'cancelled',
           cancelled_at = now(),
           cancelled_by = auth.uid(),
           cancellation_reason = coalesce(p_motivo, 'Richiesta non accolta')
     where id = p_booking_id;

    insert into portale.avvisi (member_id, tipo, titolo, corpo, booking_id, created_by)
    values (
      v_b.member_id, 'messaggio', 'Richiesta non accolta',
      'Per il ' || v_data || ' (' || v_fascia || ') non riusciamo a tenerti il posto.' ||
      case when p_motivo is not null and p_motivo <> '' then ' ' || p_motivo else '' end ||
      ' Se vuoi provare un altro giorno scrivici su WhatsApp.',
      p_booking_id, auth.uid()
    );
  end if;
end;
$$;

revoke all on function rispondi_richiesta(uuid, boolean, text) from public;
grant execute on function rispondi_richiesta(uuid, boolean, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 4. AVVISA I PARTECIPANTI DI UN'USCITA
-- Scrivi una volta, arriva nel portale di tutti. Gratis, immediato, nessun
-- numero da far bannare. Chi non ha il portale non lo riceve: lo si avvisa
-- a voce, come si fa oggi.
-- ----------------------------------------------------------------------------
create or replace function avvisa_partecipanti(
  p_outing_id uuid,
  p_titolo    text,
  p_corpo     text,
  p_tipo      text default 'messaggio'
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quanti integer;
begin
  if not is_active_staff() then
    raise exception 'Solo la segreteria puo avvisare i partecipanti.'
      using errcode = '42501';
  end if;

  insert into portale.avvisi (member_id, tipo, titolo, corpo, created_by)
  select op.member_id, p_tipo, p_titolo, p_corpo, auth.uid()
    from outing_participants op
   where op.outing_id = p_outing_id;

  get diagnostics v_quanti = row_count;
  return v_quanti;
end;
$$;

revoke all on function avvisa_partecipanti(uuid, text, text, text) from public;
grant execute on function avvisa_partecipanti(uuid, text, text, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 5. IL PORTALE: QUATTRO STATI INVECE DI TRE
-- ----------------------------------------------------------------------------
-- create or replace non basta: stiamo inserendo una colonna in mezzo, e
-- Postgres non lo permette. Nessuno dipende da questa vista.
drop view if exists portale.mie_prenotazioni;

create view portale.mie_prenotazioni as
select
  b.id,
  b.booking_date               as giorno,
  case when st.wind_session = 'peler' then 'mattina' else 'pomeriggio' end as fascia,
  coalesce(b.preferred_discipline, st.discipline) as disciplina,
  st.default_departure_time    as orario_indicativo,
  b.notes                      as note,
  b.is_waitlist                as in_lista_attesa,
  case
    when b.refused_at is not null then 'rifiutata'
    when b.status = 'cancelled'   then 'annullata'
    when b.status = 'assigned'    then 'confermata'
    when b.accepted_at is not null then 'accettata'
    else 'in_attesa'
  end                          as stato,
  b.refusal_reason             as motivo_rifiuto,
  b.cancellation_reason        as motivo_annullamento,
  b.created_at
from bookings b
join session_templates st on st.id = b.session_template_id
where b.member_id = portale.socio_member_id();

grant select on portale.mie_prenotazioni to authenticated;
