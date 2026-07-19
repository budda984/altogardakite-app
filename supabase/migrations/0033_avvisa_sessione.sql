-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0033
-- Notifica a tutti i prenotati di una sessione (giorno + template).
-- ============================================================================
-- La avvisa_partecipanti() della 0028 lavora su un'USCITA gia' creata.
-- Questa lavora a monte, sulla SESSIONE del planning: tutti i soci con una
-- prenotazione su quel giorno e quel template ricevono l'avviso nel portale.
--
-- CHI RICEVE:
--   - prenotazioni della segreteria (source = 'staff')
--   - richieste dal portale GIA' ACCETTATE
--   - inclusa la lista d'attesa: un annullamento riguarda anche loro
-- CHI NO:
--   - richieste dal portale ancora senza risposta (non gli hai detto si')
--   - rifiutate e annullate
-- ============================================================================

create or replace function avvisa_sessione(
  p_giorno      date,
  p_template_id uuid,
  p_titolo      text,
  p_corpo       text,
  p_tipo        text default 'messaggio'
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quanti integer;
begin
  if not is_active_staff() then
    raise exception 'Solo la segreteria puo notificare i partecipanti.'
      using errcode = '42501';
  end if;

  if p_tipo not in ('messaggio', 'annullamento', 'conferma', 'promemoria') then
    raise exception 'Tipo di avviso non valido: %', p_tipo;
  end if;

  insert into portale.avvisi (member_id, tipo, titolo, corpo, booking_id, created_by)
  select b.member_id, p_tipo, p_titolo, p_corpo, b.id, auth.uid()
    from bookings b
   where b.booking_date = p_giorno
     and b.session_template_id = p_template_id
     and b.status in ('pending', 'assigned')
     and b.refused_at is null
     and (b.source = 'staff' or b.accepted_at is not null);

  get diagnostics v_quanti = row_count;
  return v_quanti;
end;
$$;

revoke all on function avvisa_sessione(date, uuid, text, text, text) from public;
grant execute on function avvisa_sessione(date, uuid, text, text, text) to authenticated;
