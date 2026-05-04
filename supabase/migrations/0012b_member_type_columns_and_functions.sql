-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0012b
-- - colonne tipo socio, scadenza tessera, certificato medico
-- - listino servizi: voci tessere
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Colonne nuove sui soci
-- ----------------------------------------------------------------------------
alter table members
  add column if not exists member_type member_type not null default 'normale',
  add column if not exists joined_at date,
  add column if not exists expires_at date,
  add column if not exists medical_cert_received boolean not null default false,
  add column if not exists medical_cert_expires_at date;

comment on column members.member_type is
  'Tipologia socio: sostenitore (10€, no certificato, no uscite), normale (30€), con_lift (45€ + 1 lift incluso)';
comment on column members.joined_at is
  'Data della prima associazione o ultimo rinnovo. Determina expires_at.';
comment on column members.expires_at is
  'Data di scadenza tessera (default 30/10 dell anno successivo a joined_at)';
comment on column members.medical_cert_received is
  'Certificato medico consegnato in cartaceo';
comment on column members.medical_cert_expires_at is
  'Data scadenza certificato medico (per alert)';

-- Indici per gli alert nella dashboard
create index if not exists idx_members_expires on members(expires_at) where active = true;
create index if not exists idx_members_medical_expires on members(medical_cert_expires_at)
  where active = true and medical_cert_received = true;

-- ----------------------------------------------------------------------------
-- Servizi: aggiungi le 3 voci tessere associative
-- (non sono pacchetti lift, sono semplici addebiti contabili)
-- ----------------------------------------------------------------------------
insert into services (slug, name, category, unit_price, included_lifts, discipline, is_subscription, description, sort_order, is_active)
values
  ('tessera_sostenitore', 'Tessera socio sostenitore', 'altro', 10.00, 0, 'altro', false,
   'Quota associativa per socio sostenitore. Non puo partecipare a uscite.', 1, true),
  ('tessera_normale', 'Tessera socio normale', 'altro', 30.00, 0, 'altro', false,
   'Quota associativa per socio standard.', 2, true),
  ('tessera_con_lift', 'Tessera socio con lift incluso', 'altro', 45.00, 1, 'kite', false,
   'Quota associativa con 1 lift kite incluso.', 3, true)
on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- VIEW: alert dashboard
-- ----------------------------------------------------------------------------
create or replace view dashboard_alerts as
with today_d as (select current_date as today)
select
  -- Tessere in scadenza nei prossimi 30 giorni
  (select count(*) from members
    where active = true
      and expires_at is not null
      and expires_at >= (select today from today_d)
      and expires_at <= (select today from today_d) + interval '30 days'
  ) as memberships_expiring_soon,

  -- Tessere gia scadute (e socio ancora attivo)
  (select count(*) from members
    where active = true
      and expires_at is not null
      and expires_at < (select today from today_d)
  ) as memberships_expired,

  -- Certificati medici in scadenza nei prossimi 30 giorni
  (select count(*) from members
    where active = true
      and medical_cert_received = true
      and medical_cert_expires_at is not null
      and medical_cert_expires_at >= (select today from today_d)
      and medical_cert_expires_at <= (select today from today_d) + interval '30 days'
  ) as medical_certs_expiring_soon,

  -- Certificati medici scaduti
  (select count(*) from members
    where active = true
      and medical_cert_received = true
      and medical_cert_expires_at is not null
      and medical_cert_expires_at < (select today from today_d)
  ) as medical_certs_expired,

  -- Soci con member_type != sostenitore senza certificato medico
  (select count(*) from members
    where active = true
      and member_type != 'sostenitore'
      and medical_cert_received = false
  ) as members_missing_medical;

-- ----------------------------------------------------------------------------
-- FUNCTION: rinnova tessera socio
-- - se l'utente fornisce nuovo member_type, lo aggiorna
-- - imposta joined_at = today, expires_at = 30/10 dell anno successivo
-- - genera il movimento contabile della quota (pagato o a debito)
-- - se member_type = 'con_lift', crea anche pacchetto da 1 lift
-- ----------------------------------------------------------------------------
create or replace function renew_membership(
  p_member_id uuid,
  p_new_type member_type,
  p_paid_now boolean,
  p_payment_method payment_method,
  p_renewed_by uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member members%rowtype;
  v_today date := current_date;
  v_expires date;
  v_service services%rowtype;
  v_pkg_id uuid;
  v_amount numeric(10,2);
  v_slug text;
begin
  select * into v_member from members where id = p_member_id for update;
  if not found then
    raise exception 'Socio non trovato';
  end if;

  -- Calcolo nuova scadenza: 30/10 dell anno successivo (se siamo dopo il 30/10
  -- dell'anno corrente) altrimenti 30/10 dell'anno corrente
  if v_today > make_date(extract(year from v_today)::int, 10, 30) then
    v_expires := make_date(extract(year from v_today)::int + 1, 10, 30);
  else
    v_expires := make_date(extract(year from v_today)::int, 10, 30);
  end if;

  -- Slug servizio in base al tipo
  v_slug := case p_new_type
    when 'sostenitore' then 'tessera_sostenitore'
    when 'normale' then 'tessera_normale'
    when 'con_lift' then 'tessera_con_lift'
  end;

  select * into v_service from services where slug = v_slug;
  if not found then
    raise exception 'Servizio tessera % non configurato', v_slug;
  end if;

  v_amount := v_service.unit_price;

  -- Aggiorna socio
  update members
    set member_type = p_new_type,
        joined_at = v_today,
        expires_at = v_expires,
        active = true  -- riattiva se era disattivato
    where id = p_member_id;

  -- Crea pacchetto lift se con_lift
  if p_new_type = 'con_lift' and v_service.included_lifts > 0 then
    insert into packages (
      member_id, service_id, service_name_snapshot, discipline,
      lifts_total, lifts_used, total_price,
      is_subscription, valid_from, valid_until,
      notes
    ) values (
      p_member_id, v_service.id, v_service.name, v_service.discipline,
      v_service.included_lifts, 0, 0,
      false, null, null,
      'Lift incluso nella tessera ' || v_service.name
    ) returning id into v_pkg_id;
  end if;

  -- Crea movimento contabile della quota
  insert into movements (
    member_id, movement_type, description,
    amount, lift_delta, lift_discipline,
    package_id,
    paid, payment_method,
    notes, created_by
  ) values (
    p_member_id, 'addebito',
    v_service.name || ' (rinnovo ' || to_char(v_today, 'YYYY') || ')',
    case when p_paid_now then v_amount else -v_amount end,
    case when p_new_type = 'con_lift' then 1 else 0 end,
    case when p_new_type = 'con_lift' then v_service.discipline else null end,
    v_pkg_id,
    p_paid_now,
    case when p_paid_now then p_payment_method else null end,
    null, p_renewed_by
  );

  return jsonb_build_object(
    'member_type', p_new_type,
    'expires_at', v_expires,
    'amount', v_amount,
    'package_created', v_pkg_id is not null
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- FUNCTION: aggiusta crediti manualmente (rettifica admin)
-- - aggiunge un pacchetto "rettifica" con N lift di una disciplina
-- ----------------------------------------------------------------------------
create or replace function adjust_credits(
  p_member_id uuid,
  p_discipline lift_discipline,
  p_lifts_to_add integer,  -- positivo: aggiunge, negativo: toglie (rara)
  p_reason text,
  p_adjusted_by uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pkg_id uuid;
begin
  if p_lifts_to_add = 0 then
    raise exception 'Specifica un numero di lift diverso da zero';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Motivazione obbligatoria';
  end if;

  -- Crea un pacchetto di rettifica
  insert into packages (
    member_id, service_id, service_name_snapshot, discipline,
    lifts_total, lifts_used, total_price,
    is_subscription, notes
  ) values (
    p_member_id,
    null,
    'Rettifica manuale ' || p_discipline::text,
    p_discipline,
    abs(p_lifts_to_add),
    case when p_lifts_to_add < 0 then abs(p_lifts_to_add) else 0 end,
    0,
    false,
    p_reason
  ) returning id into v_pkg_id;

  -- Movimento informativo
  insert into movements (
    member_id, movement_type, description,
    amount, lift_delta, lift_discipline,
    package_id, paid, notes, created_by
  ) values (
    p_member_id, 'correzione',
    case
      when p_lifts_to_add > 0 then 'Crediti aggiunti: ' || p_lifts_to_add || ' lift ' || p_discipline::text
      else 'Crediti tolti: ' || abs(p_lifts_to_add) || ' lift ' || p_discipline::text
    end,
    0,
    p_lifts_to_add,
    p_discipline,
    v_pkg_id, true, p_reason, p_adjusted_by
  );

  return v_pkg_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- FUNCTION: deactivate_expired_memberships
-- chiama nel cron giornaliero o on-demand
-- ----------------------------------------------------------------------------
create or replace function deactivate_expired_memberships()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with deact as (
    update members
       set active = false
     where active = true
       and expires_at is not null
       and expires_at < current_date
    returning id
  )
  select count(*) into v_count from deact;
  return v_count;
end;
$$;
