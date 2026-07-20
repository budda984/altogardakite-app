-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0036
-- avvisa_sessione: restituisce i NOMI e non notifica la lista d'attesa.
-- ============================================================================
-- Due correzioni alla funzione della 0033:
--   1. Non notifica piu' chi e' in lista d'attesa (non ha un posto, non
--      deve ricevere gli aggiornamenti della sessione).
--   2. Ritorna l'elenco dei destinatari invece del solo conteggio, cosi'
--      dopo l'invio lo staff vede A CHI e' arrivato l'avviso.
--
-- Cambia il tipo di ritorno, quindi va prima eliminata la vecchia versione.
-- ============================================================================

drop function if exists avvisa_sessione(date, uuid, text, text, text);

create function avvisa_sessione(
  p_giorno      date,
  p_template_id uuid,
  p_titolo      text,
  p_corpo       text,
  p_tipo        text default 'messaggio'
) returns table (member_id uuid, nome text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_active_staff() then
    raise exception 'Solo la segreteria puo notificare i partecipanti.'
      using errcode = '42501';
  end if;

  if p_tipo not in ('messaggio', 'annullamento', 'conferma', 'promemoria') then
    raise exception 'Tipo di avviso non valido: %', p_tipo;
  end if;

  return query
  with inseriti as (
    insert into portale.avvisi (member_id, tipo, titolo, corpo, booking_id, created_by)
    select b.member_id, p_tipo, p_titolo, p_corpo, b.id, auth.uid()
      from bookings b
     where b.booking_date = p_giorno
       and b.session_template_id = p_template_id
       and b.status in ('pending', 'assigned')
       and b.refused_at is null
       and b.is_waitlist = false
       and (b.source = 'staff' or b.accepted_at is not null)
    returning avvisi.member_id
  )
  select i.member_id, (m.first_name || ' ' || m.last_name)
    from inseriti i
    join members m on m.id = i.member_id
   order by m.first_name, m.last_name;
end;
$$;

revoke all on function avvisa_sessione(date, uuid, text, text, text) from public;
grant execute on function avvisa_sessione(date, uuid, text, text, text) to authenticated;
