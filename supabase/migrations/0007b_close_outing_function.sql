-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0007b
-- Function close_outing: chiude un'uscita generando tutti gli addebiti
-- ============================================================================

-- ----------------------------------------------------------------------------
-- close_outing: chiude un'uscita in una transazione atomica
--
-- Logica per ogni partecipante:
-- 1. Lift / lift_supervisionato:
--    a. Se ha abbonamento attivo per la disciplina → registra movimento informativo (amount 0)
--    b. Altrimenti se ha pacchetto a lift residui → consuma 1 lift (FIFO)
--    c. Altrimenti → addebito non pagato del costo lift singolo
-- 2. Noleggio (rental_type != 'nessuno'):
--    a. Se ha abbonamento attrezzatura attivo → nessun addebito
--    b. Altrimenti → addebito non pagato del costo noleggio
-- 3. Corso: nessun addebito automatico (i corsi sono fatturati a parte
--    via la pagina /corsi)
-- ----------------------------------------------------------------------------
create or replace function close_outing(
  p_outing_id uuid,
  p_closed_by uuid,
  p_lift_prices jsonb,    -- { "kite": 35.00, "wingfoil": null, ... } prezzo per disciplina
  p_rental_prices jsonb   -- { "completo": 35.00, "solo_kite": 30.00, ... }
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_outing record;
  v_participant record;
  v_pkg packages%rowtype;
  v_has_lift_sub boolean;
  v_has_attrezzatura_sub boolean;
  v_lift_price numeric(10,2);
  v_rental_price numeric(10,2);
  v_charges_created integer := 0;
  v_lifts_consumed integer := 0;
  v_subs_used integer := 0;
  v_total_amount numeric(10,2) := 0;
begin
  -- Lock l'uscita
  select * into v_outing from outings where id = p_outing_id for update;
  if not found then
    raise exception 'Uscita non trovata';
  end if;
  if v_outing.status = 'chiusa' then
    raise exception 'Uscita gia'' chiusa';
  end if;

  -- Per ogni partecipante
  for v_participant in
    select op.*, m.first_name, m.last_name, b.name as boat_name
    from outing_participants op
    join members m on m.id = op.member_id
    left join boats b on b.id = v_outing.boat_id
    where op.outing_id = p_outing_id
  loop
    -- LIFT (se participation_type richiede un lift)
    if v_participant.participation_type in ('lift_semplice', 'lift_supervisionato') then
      -- 1. Abbonamento attivo?
      v_has_lift_sub := has_active_subscription(
        v_participant.member_id,
        coalesce(v_outing.discipline, 'kite')
      );

      if v_has_lift_sub then
        -- Registra movimento informativo
        insert into movements (
          member_id, movement_type, description,
          amount, lift_delta, lift_discipline,
          outing_id, participant_id,
          paid, created_by
        ) values (
          v_participant.member_id, 'consumo_lift',
          'Lift ' || coalesce(v_outing.discipline::text, 'kite') ||
            ' coperto da abbonamento (uscita ' || coalesce(v_participant.boat_name, '?') || ')',
          0, 0, coalesce(v_outing.discipline, 'kite'),
          p_outing_id, v_participant.id,
          true, p_closed_by
        );
        v_subs_used := v_subs_used + 1;
      else
        -- 2. Pacchetto a lift residui? (FIFO, escludendo abbonamenti)
        select * into v_pkg
          from packages
          where member_id = v_participant.member_id
            and is_subscription = false
            and discipline = coalesce(v_outing.discipline, 'kite')
            and is_exhausted = false
          order by created_at asc
          limit 1
          for update;

        if found then
          -- Scala il lift dal pacchetto
          update packages
            set lifts_used = lifts_used + 1
            where id = v_pkg.id;

          insert into movements (
            member_id, movement_type, description,
            amount, lift_delta, lift_discipline,
            package_id, outing_id, participant_id,
            paid, created_by
          ) values (
            v_participant.member_id, 'consumo_lift',
            'Lift consumato da ' || v_pkg.service_name_snapshot,
            0, -1, coalesce(v_outing.discipline, 'kite'),
            v_pkg.id, p_outing_id, v_participant.id,
            true, p_closed_by
          );
          v_lifts_consumed := v_lifts_consumed + 1;
        else
          -- 3. Nessun credito → addebito
          v_lift_price := (p_lift_prices->>coalesce(v_outing.discipline::text, 'kite'))::numeric;
          if v_lift_price is null or v_lift_price <= 0 then
            v_lift_price := 35.00;  -- fallback default
          end if;

          insert into movements (
            member_id, movement_type, description,
            amount, lift_delta,
            outing_id, participant_id,
            paid, created_by
          ) values (
            v_participant.member_id, 'addebito',
            'Lift ' || coalesce(v_outing.discipline::text, 'kite') ||
              ' (uscita ' || coalesce(v_participant.boat_name, '?') || ')',
            -v_lift_price, 0,
            p_outing_id, v_participant.id,
            false, p_closed_by
          );
          v_charges_created := v_charges_created + 1;
          v_total_amount := v_total_amount + v_lift_price;
        end if;
      end if;
    end if;

    -- NOLEGGIO (se rental_type != 'nessuno')
    if v_participant.rental_type is not null and v_participant.rental_type::text != 'nessuno' then
      -- Verifica abbonamento attrezzatura: discipline 'altro' o quella dell'uscita,
      -- per il pacchetto stagionale attrezzatura
      select exists (
        select 1 from packages
        where member_id = v_participant.member_id
          and is_subscription = true
          and (
            -- Match esplicito dello slug stagionale_attrezzatura
            service_id in (select id from services where slug = 'stagionale_attrezzatura')
          )
          and valid_from <= current_date
          and valid_until >= current_date
      ) into v_has_attrezzatura_sub;

      if not v_has_attrezzatura_sub then
        -- Calcola prezzo: usa override se impostato, altrimenti prezzo da listino
        if v_participant.rental_charge_amount is not null and v_participant.rental_charge_amount > 0 then
          v_rental_price := v_participant.rental_charge_amount;
        else
          v_rental_price := (p_rental_prices->>v_participant.rental_type::text)::numeric;
        end if;

        if v_rental_price is not null and v_rental_price > 0 then
          insert into movements (
            member_id, movement_type, description,
            amount, lift_delta,
            outing_id, participant_id,
            paid, created_by
          ) values (
            v_participant.member_id, 'addebito',
            'Noleggio ' || v_participant.rental_type::text ||
              ' (uscita ' || coalesce(v_participant.boat_name, '?') || ')',
            -v_rental_price, 0,
            p_outing_id, v_participant.id,
            false, p_closed_by
          );
          v_charges_created := v_charges_created + 1;
          v_total_amount := v_total_amount + v_rental_price;
        end if;
      else
        -- Movimento informativo per abbonamento attrezzatura
        insert into movements (
          member_id, movement_type, description,
          amount, lift_delta,
          outing_id, participant_id,
          paid, created_by
        ) values (
          v_participant.member_id, 'consumo_lift',
          'Noleggio ' || v_participant.rental_type::text ||
            ' coperto da abbonamento attrezzatura',
          0, 0,
          p_outing_id, v_participant.id,
          true, p_closed_by
        );
        v_subs_used := v_subs_used + 1;
      end if;
    end if;
  end loop;

  -- Marca l'uscita come chiusa
  update outings
    set status = 'chiusa', closed_at = now(), closed_by = p_closed_by
    where id = p_outing_id;

  return jsonb_build_object(
    'charges_created', v_charges_created,
    'lifts_consumed', v_lifts_consumed,
    'subscriptions_used', v_subs_used,
    'total_charged', v_total_amount
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- reopen_outing: storna i movimenti e rimette in bozza
-- ----------------------------------------------------------------------------
create or replace function reopen_outing(
  p_outing_id uuid,
  p_reopened_by uuid
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
begin
  select * into v_outing from outings where id = p_outing_id for update;
  if not found then
    raise exception 'Uscita non trovata';
  end if;
  if v_outing.status != 'chiusa' then
    raise exception 'Solo uscite chiuse possono essere riaperte';
  end if;

  -- Per ogni movimento collegato all'uscita non gia' stornato
  for v_movement in
    select * from movements
    where outing_id = p_outing_id
      and is_reversed = false
  loop
    -- Se il movimento ha consumato un lift da pacchetto, ripristinalo
    if v_movement.lift_delta = -1 and v_movement.package_id is not null then
      update packages
        set lifts_used = greatest(0, lifts_used - 1)
        where id = v_movement.package_id;
      v_count_lift_restored := v_count_lift_restored + 1;
    end if;

    -- Crea il movimento di storno (importo opposto)
    insert into movements (
      member_id, movement_type, description,
      amount, lift_delta, lift_discipline,
      package_id, outing_id, participant_id,
      paid, payment_method,
      notes, created_by
    ) values (
      v_movement.member_id, 'correzione',
      'Storno: ' || v_movement.description,
      -v_movement.amount,
      -v_movement.lift_delta,
      v_movement.lift_discipline,
      null,  -- non legare il pacchetto allo storno
      p_outing_id,
      v_movement.participant_id,
      true,
      v_movement.payment_method,
      'Generato dalla riapertura uscita',
      p_reopened_by
    ) returning id into v_storno_id;

    -- Marca l'originale come stornato
    update movements
      set is_reversed = true,
          reversed_by_movement_id = v_storno_id
      where id = v_movement.id;

    v_count_reversed := v_count_reversed + 1;
  end loop;

  -- Marca uscita come bozza
  update outings
    set status = 'bozza', closed_at = null, closed_by = null
    where id = p_outing_id;

  return jsonb_build_object(
    'movements_reversed', v_count_reversed,
    'lifts_restored', v_count_lift_restored
  );
end;
$$;
