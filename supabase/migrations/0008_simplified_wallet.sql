-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0008
-- Semplificazione wallet: solo debiti aperti, niente saldo a credito
-- ============================================================================

-- ----------------------------------------------------------------------------
-- VIEW aggiornate: solo debiti aperti, no saldo monetario complessivo
-- ----------------------------------------------------------------------------
drop view if exists member_wallets;
create view member_wallets as
select
  m.id as member_id,
  m.first_name,
  m.last_name,
  m.membership_number,
  -- Totale debiti ancora aperti (movimenti negativi non pagati e non stornati)
  coalesce(sum(-mv.amount) filter (
    where mv.amount < 0 and mv.paid = false and mv.is_reversed = false
  ), 0)::numeric(10,2) as total_outstanding,
  -- Quanti debiti sono ancora aperti
  count(mv.id) filter (
    where mv.amount < 0 and mv.paid = false and mv.is_reversed = false
  ) as open_debts_count,
  -- Totale pagato cumulativo (per statistiche)
  coalesce(sum(mv.amount) filter (
    where mv.amount > 0 and mv.paid = true and mv.is_reversed = false
  ), 0)::numeric(10,2) as total_received,
  -- Totale movimenti
  count(mv.id) filter (where mv.is_reversed = false) as movements_count
from members m
left join movements mv on mv.member_id = m.id
group by m.id, m.first_name, m.last_name, m.membership_number;

-- ----------------------------------------------------------------------------
-- VIEW per la scheda socio: i debiti aperti dettagliati
-- (un movimento per riga, con riferimento all'uscita se applicabile)
-- ----------------------------------------------------------------------------
drop view if exists member_open_debts;
create view member_open_debts as
select
  mv.id as movement_id,
  mv.member_id,
  mv.movement_date,
  mv.description,
  -mv.amount as amount_due,
  mv.outing_id,
  mv.participant_id,
  mv.notes,
  o.outing_date,
  o.discipline as outing_discipline,
  b.name as boat_name
from movements mv
left join outings o on o.id = mv.outing_id
left join boats b on b.id = o.boat_id
where mv.amount < 0
  and mv.paid = false
  and mv.is_reversed = false;

-- ----------------------------------------------------------------------------
-- FUNCTION: salda uno o piu' debiti specifici
-- Genera un movimento di pagamento positivo e marca i debiti come paid.
-- ----------------------------------------------------------------------------
create or replace function settle_debts(
  p_member_id uuid,
  p_movement_ids uuid[],
  p_payment_method payment_method,
  p_paid_by uuid,
  p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric(10,2) := 0;
  v_descriptions text[] := array[]::text[];
  v_count integer := 0;
  v_movement movements%rowtype;
begin
  -- Per ogni debito, somma e marca paid
  foreach v_movement.id in array p_movement_ids loop
    select * into v_movement
      from movements
      where id = v_movement.id
        and member_id = p_member_id
        and amount < 0
        and paid = false
        and is_reversed = false
      for update;

    if not found then
      continue;  -- skip silenziosamente movimenti gia' pagati o non validi
    end if;

    update movements
      set paid = true, payment_method = p_payment_method
      where id = v_movement.id;

    v_total := v_total + (-v_movement.amount);
    v_descriptions := v_descriptions || v_movement.description;
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'Nessun debito valido da saldare';
  end if;

  -- Crea il movimento di pagamento (entrata di cassa)
  insert into movements (
    member_id, movement_type, description,
    amount, lift_delta, paid, payment_method,
    notes, created_by
  ) values (
    p_member_id, 'pagamento',
    case
      when v_count = 1 then 'Saldo: ' || v_descriptions[1]
      else 'Saldo ' || v_count || ' debiti'
    end,
    v_total, 0, true, p_payment_method,
    p_notes, p_paid_by
  );

  return jsonb_build_object(
    'settled_count', v_count,
    'total_paid', v_total
  );
end;
$$;
