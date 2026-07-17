-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0027
-- Portale soci: stringe i permessi sugli avvisi.
-- ============================================================================
-- La 0026 dava al socio 'update' su tutta la riga per fargli segnare i
-- messaggi come letti. Poteva quindi riscrivere il testo dei propri avvisi.
-- Danno praticamente nullo (sono suoi), ma incoerente: nel portale il socio
-- scrive SOLO attraverso funzioni. Qui rimettiamo la regola.
--
-- Additiva e sicura: lo staff non e' toccato.
-- ============================================================================

drop policy if exists "socio_segna_letto" on portale.avvisi;

revoke update on portale.avvisi from authenticated;

-- Lo staff continua a fare tutto tramite la policy staff_all_avvisi.
grant update on portale.avvisi to authenticated;

-- ...ma la policy che restava al socio non c'e' piu', quindi per lui
-- l'update e' bloccato da RLS. Passa solo da qui:
create or replace function portale.segna_letti()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_quanti    integer;
begin
  v_member_id := portale.socio_member_id();
  if v_member_id is null then
    return 0;
  end if;

  update portale.avvisi
     set letto_il = now()
   where member_id = v_member_id
     and letto_il is null;

  get diagnostics v_quanti = row_count;
  return v_quanti;
end;
$$;

revoke all on function portale.segna_letti() from public;
grant execute on function portale.segna_letti() to authenticated;

-- Quanti ne ha non letti: serve al pallino sulla barra di navigazione.
create or replace function portale.avvisi_non_letti()
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::integer
    from portale.avvisi
   where member_id = portale.socio_member_id()
     and letto_il is null;
$$;

revoke all on function portale.avvisi_non_letti() from public;
grant execute on function portale.avvisi_non_letti() to authenticated;
