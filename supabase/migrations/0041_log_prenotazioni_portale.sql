-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0041
-- Le prenotazioni dal portale finiscono nel registro attivita.
-- ============================================================================
-- Quando un socio prenota o annulla dal portale, la scrittura passa dalle
-- funzioni richiedi_posto / annulla_richiesta, che non toccano activity_log.
-- Invece di rincorrere ogni punto del codice, e' il database stesso a
-- registrare l'evento con un trigger sulla tabella bookings: cosi' nessuna
-- prenotazione da portale sfugge al log, oggi e in futuro.
--
-- Le prenotazioni da staff NON passano di qui: le loggano gia' le API del
-- gestionale (evitiamo doppioni filtrando su source = 'portale').
--
-- Additiva: aggiunge due funzioni e due trigger, non tocca nulla di esistente.
-- ============================================================================

-- Nome del socio, per rendere il log leggibile nel tempo.
create or replace function portale.log_nome_socio(p_member_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(first_name || ' ' || last_name, 'Socio')
    from members where id = p_member_id;
$$;

-- ── Prenotazione creata dal portale ─────────────────────────────────────────
create or replace function portale.log_prenotazione_portale()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_giorno text;
begin
  if new.source <> 'portale' then
    return new;
  end if;

  v_nome := portale.log_nome_socio(new.member_id);
  v_giorno := to_char(new.booking_date, 'DD/MM/YYYY');

  insert into activity_log (actor_id, actor_name, action, description, metadata)
  values (
    null,
    v_nome,
    case when new.is_waitlist then 'booking.portal.waitlist' else 'booking.portal.create' end,
    v_nome || ' ha ' ||
      case when new.is_waitlist then 'chiesto la lista d''attesa' else 'prenotato dal portale' end ||
      ' per il ' || v_giorno,
    jsonb_build_object(
      'booking_id', new.id,
      'member_id', new.member_id,
      'giorno', new.booking_date,
      'waitlist', new.is_waitlist
    )
  );

  return new;
end;
$$;

create trigger trg_log_prenotazione_portale
  after insert on bookings
  for each row execute function portale.log_prenotazione_portale();

-- ── Prenotazione annullata dal portale ──────────────────────────────────────
-- annulla_richiesta cancella la riga: leggiamo i dati in OLD.
create or replace function portale.log_annullo_portale()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_giorno text;
begin
  if old.source <> 'portale' then
    return old;
  end if;

  v_nome := portale.log_nome_socio(old.member_id);
  v_giorno := to_char(old.booking_date, 'DD/MM/YYYY');

  insert into activity_log (actor_id, actor_name, action, description, metadata)
  values (
    null,
    v_nome,
    'booking.portal.cancel',
    v_nome || ' ha annullato la prenotazione dal portale per il ' || v_giorno,
    jsonb_build_object(
      'booking_id', old.id,
      'member_id', old.member_id,
      'giorno', old.booking_date
    )
  );

  return old;
end;
$$;

create trigger trg_log_annullo_portale
  after delete on bookings
  for each row execute function portale.log_annullo_portale();
