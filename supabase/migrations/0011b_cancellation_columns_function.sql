-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0011b
-- FASE 2: colonne di annullamento + function cancel_outing
--
-- PREREQUISITO: il file 0011_add_annullata_status.sql deve essere stato
-- eseguito e committato.
-- ============================================================================

-- Colonne di annullamento sull'uscita
alter table outings
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id) on delete set null,
  add column if not exists cancellation_reason text;

create index if not exists idx_outings_cancelled on outings(cancelled_at)
  where cancelled_at is not null;

-- ----------------------------------------------------------------------------
-- FUNCTION cancel_outing: annulla un'uscita
-- - se era CHIUSA: storna tutti i movimenti generati, ripristina i lift
-- - se era BOZZA: marca semplicemente come annullata
-- - se era gia' annullata: errore
-- ----------------------------------------------------------------------------
create or replace function cancel_outing(
  p_outing_id uuid,
  p_cancelled_by uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_outing record;
  v_movement record;
  v_storno_id uuid;
  v_count_reversed integer := 0;
  v_count_lift_restored integer := 0;
  v_was_closed boolean;
begin
  select * into v_outing from outings where id = p_outing_id for update;
  if not found then
    raise exception 'Uscita non trovata';
  end if;
  if v_outing.status = 'annullata' then
    raise exception 'Uscita gia'' annullata';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Motivazione annullamento obbligatoria';
  end if;

  v_was_closed := (v_outing.status = 'chiusa');

  -- Se era chiusa: storna i movimenti come fa reopen_outing
  if v_was_closed then
    for v_movement in
      select * from movements
      where outing_id = p_outing_id
        and is_reversed = false
    loop
      -- Ripristina lift consumati
      if v_movement.lift_delta = -1 and v_movement.package_id is not null then
        update packages
          set lifts_used = greatest(0, lifts_used - 1)
          where id = v_movement.package_id;
        v_count_lift_restored := v_count_lift_restored + 1;
      end if;

      -- Movimento di storno
      insert into movements (
        member_id, movement_type, description,
        amount, lift_delta, lift_discipline,
        package_id, outing_id, participant_id,
        paid, payment_method,
        notes, created_by
      ) values (
        v_movement.member_id, 'correzione',
        'Storno (annullamento uscita): ' || v_movement.description,
        -v_movement.amount,
        -v_movement.lift_delta,
        v_movement.lift_discipline,
        null,
        p_outing_id,
        v_movement.participant_id,
        true,
        v_movement.payment_method,
        coalesce('Annullamento per: ' || p_reason, 'Annullamento uscita'),
        p_cancelled_by
      ) returning id into v_storno_id;

      update movements
        set is_reversed = true,
            reversed_by_movement_id = v_storno_id
        where id = v_movement.id;

      v_count_reversed := v_count_reversed + 1;
    end loop;
  end if;

  -- Marca uscita come annullata
  update outings
    set status = 'annullata',
        cancelled_at = now(),
        cancelled_by = p_cancelled_by,
        cancellation_reason = p_reason,
        -- conserva closed_at originale per storia se era chiusa
        closed_at = case when v_was_closed then closed_at else null end,
        closed_by = case when v_was_closed then closed_by else null end
    where id = p_outing_id;

  return jsonb_build_object(
    'was_closed', v_was_closed,
    'movements_reversed', v_count_reversed,
    'lifts_restored', v_count_lift_restored
  );
end;
$$;
