-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0009b
-- close_outing aggiornata: gestione participation_type = 'corso'
--
-- Logica corso:
-- 1. Se ha pacchetto corso residui (discipline='corso', non subscription) → scala 1
-- 2. Altrimenti → addebito non pagato del prezzo "lezione singola"
-- ----------------------------------------------------------------------------

create or replace function close_outing(
  p_outing_id uuid,
  p_closed_by uuid,
  p_lift_prices jsonb,    -- prezzo lift per disciplina
  p_rental_prices jsonb,  -- prezzi noleggi per rental_type
  p_lesson_price numeric default null  -- prezzo lezione singola
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
  v_lesson_price numeric(10,2);
  v_charges_created integer := 0;
  v_lifts_consumed integer := 0;
  v_lessons_consumed integer := 0;
  v_subs_used integer := 0;
  v_total_amount numeric(10,2) := 0;
begin
  select * into v_outing from outings where id = p_outing_id for update;
  if not found then
    raise exception 'Uscita non trovata';
  end if;
  if v_outing.status = 'chiusa' then
    raise exception 'Uscita gia'' chiusa';
  end if;

  -- prezzo lezione default se non passato
  v_lesson_price := coalesce(p_lesson_price, 60.00);

  for v_participant in
    select op.*, m.first_name, m.last_name, b.name as boat_name
    from outing_participants op
    join members m on m.id = op.member_id
    left join boats b on b.id = v_outing.boat_id
    where op.outing_id = p_outing_id
  loop
    -- ====================================================================
    -- CASO 1: CORSO
    -- ====================================================================
    if v_participant.participation_type = 'corso' then
      -- Cerca un pacchetto corsi residuo (FIFO)
      select * into v_pkg
        from packages
        where member_id = v_participant.member_id
          and is_subscription = false
          and discipline = 'corso'
          and is_exhausted = false
        order by created_at asc
        limit 1
        for update;

      if found then
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
          'Lezione consumata da ' || v_pkg.service_name_snapshot ||
            ' (uscita ' || coalesce(v_participant.boat_name, '?') || ')',
          0, -1, 'corso',
          v_pkg.id, p_outing_id, v_participant.id,
          true, p_closed_by
        );
        v_lessons_consumed := v_lessons_consumed + 1;
      else
        -- Addebito lezione singola
        insert into movements (
          member_id, movement_type, description,
          amount, lift_delta,
          outing_id, participant_id,
          paid, created_by
        ) values (
          v_participant.member_id, 'addebito',
          'Lezione corso (uscita ' || coalesce(v_participant.boat_name, '?') || ')',
          -v_lesson_price, 0,
          p_outing_id, v_participant.id,
          false, p_closed_by
        );
        v_charges_created := v_charges_created + 1;
        v_total_amount := v_total_amount + v_lesson_price;
      end if;

    -- ====================================================================
    -- CASO 2: LIFT SEMPLICE / SUPERVISIONATO
    -- ====================================================================
    elsif v_participant.participation_type in ('lift_semplice', 'lift_supervisionato') then
      v_has_lift_sub := has_active_subscription(
        v_participant.member_id,
        coalesce(v_outing.discipline, 'kite')
      );

      if v_has_lift_sub then
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
          v_lift_price := (p_lift_prices->>coalesce(v_outing.discipline::text, 'kite'))::numeric;
          if v_lift_price is null or v_lift_price <= 0 then
            v_lift_price := 35.00;
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

    -- ====================================================================
    -- NOLEGGIO (per qualsiasi tipo di partecipazione)
    -- ====================================================================
    if v_participant.rental_type is not null and v_participant.rental_type::text != 'nessuno' then
      select exists (
        select 1 from packages
        where member_id = v_participant.member_id
          and is_subscription = true
          and service_id in (select id from services where slug = 'stagionale_attrezzatura')
          and valid_from <= current_date
          and valid_until >= current_date
      ) into v_has_attrezzatura_sub;

      if not v_has_attrezzatura_sub then
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

  update outings
    set status = 'chiusa', closed_at = now(), closed_by = p_closed_by
    where id = p_outing_id;

  return jsonb_build_object(
    'charges_created', v_charges_created,
    'lifts_consumed', v_lifts_consumed,
    'lessons_consumed', v_lessons_consumed,
    'subscriptions_used', v_subs_used,
    'total_charged', v_total_amount
  );
end;
$$;
