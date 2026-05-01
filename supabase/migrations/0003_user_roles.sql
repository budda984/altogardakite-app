-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0003
-- Sistema ruoli e approvazione utenti
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ENUM dei ruoli
-- ----------------------------------------------------------------------------
create type user_role as enum ('pending', 'staff', 'admin');

-- ----------------------------------------------------------------------------
-- TABELLA profiles (1-a-1 con auth.users)
-- ----------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'pending',
  display_name text,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_role on profiles(role);
create index idx_profiles_suspended on profiles(suspended);

create trigger trg_profiles_updated_at before update on profiles
  for each row execute procedure set_updated_at();

-- ----------------------------------------------------------------------------
-- TRIGGER: alla creazione di un nuovo auth.users, crea automaticamente
-- un profilo in stato 'pending'
-- ----------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ----------------------------------------------------------------------------
-- HELPER FUNCTIONS per RLS
-- (security definer per non causare recursion infinita nelle policies)
-- ----------------------------------------------------------------------------
create or replace function is_active_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role in ('staff', 'admin')
      and suspended = false
  );
$$;

create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role = 'admin'
      and suspended = false
  );
$$;

-- ----------------------------------------------------------------------------
-- RLS sulla tabella profiles
-- ----------------------------------------------------------------------------
alter table profiles enable row level security;

-- Ognuno legge il PROPRIO profilo (per sapere il proprio ruolo)
create policy "users_read_own_profile" on profiles
  for select to authenticated
  using (id = auth.uid());

-- Gli admin leggono tutti i profili
create policy "admins_read_all_profiles" on profiles
  for select to authenticated
  using (is_admin());

-- Solo gli admin modificano i profili (cambio ruolo, sospensione, ecc)
create policy "admins_update_profiles" on profiles
  for update to authenticated
  using (is_admin())
  with check (is_admin());

-- Solo gli admin cancellano profili (raro)
create policy "admins_delete_profiles" on profiles
  for delete to authenticated
  using (is_admin());

-- ----------------------------------------------------------------------------
-- RIMOZIONE delle vecchie policies "auth_all_*" e creazione nuove
-- (le vecchie policy davano accesso a chiunque autenticato; ora richiedono
--  ruolo staff/admin attivo)
-- ----------------------------------------------------------------------------

-- MEMBERS
drop policy if exists "auth_all_members" on members;
create policy "staff_all_members" on members
  for all to authenticated
  using (is_active_staff()) with check (is_active_staff());

-- INSTRUCTORS
drop policy if exists "auth_all_instructors" on instructors;
create policy "staff_all_instructors" on instructors
  for all to authenticated
  using (is_active_staff()) with check (is_active_staff());

-- BOATS
drop policy if exists "auth_all_boats" on boats;
create policy "staff_all_boats" on boats
  for all to authenticated
  using (is_active_staff()) with check (is_active_staff());

-- EQUIPMENT
drop policy if exists "auth_all_equipment" on equipment;
create policy "staff_all_equipment" on equipment
  for all to authenticated
  using (is_active_staff()) with check (is_active_staff());

-- COURSES
drop policy if exists "auth_all_courses" on courses;
create policy "staff_all_courses" on courses
  for all to authenticated
  using (is_active_staff()) with check (is_active_staff());

-- OUTINGS
drop policy if exists "auth_all_outings" on outings;
create policy "staff_all_outings" on outings
  for all to authenticated
  using (is_active_staff()) with check (is_active_staff());

-- OUTING_INSTRUCTORS
drop policy if exists "auth_all_outing_instructors" on outing_instructors;
create policy "staff_all_outing_instructors" on outing_instructors
  for all to authenticated
  using (is_active_staff()) with check (is_active_staff());

-- OUTING_PARTICIPANTS
drop policy if exists "auth_all_outing_participants" on outing_participants;
create policy "staff_all_outing_participants" on outing_participants
  for all to authenticated
  using (is_active_staff()) with check (is_active_staff());

-- OUTING_PARTICIPANT_EQUIPMENT
drop policy if exists "auth_all_outing_participant_equipment" on outing_participant_equipment;
create policy "staff_all_outing_participant_equipment" on outing_participant_equipment
  for all to authenticated
  using (is_active_staff()) with check (is_active_staff());

-- SERVICES
drop policy if exists "auth_all_services" on services;
create policy "staff_all_services" on services
  for all to authenticated
  using (is_active_staff()) with check (is_active_staff());

-- MEMBER_SERVICES
drop policy if exists "auth_all_member_services" on member_services;
create policy "staff_all_member_services" on member_services
  for all to authenticated
  using (is_active_staff()) with check (is_active_staff());

-- EQUIPMENT_TRANSACTIONS
drop policy if exists "auth_all_equipment_transactions" on equipment_transactions;
create policy "staff_all_equipment_transactions" on equipment_transactions
  for all to authenticated
  using (is_active_staff()) with check (is_active_staff());

-- ----------------------------------------------------------------------------
-- SEED DEL PRIMO ADMIN
-- ----------------------------------------------------------------------------
-- IMPORTANTE: prima di eseguire questo blocco devi avere gia' creato il tuo
-- account auth.users via l'UI di registrazione (/registrati) o dal dashboard
-- Supabase. Poi sostituisci 'andrea@altogardakite.it' con la TUA email reale
-- ed esegui solo il blocco sotto.
--
-- Esegui questo dopo la prima registrazione del tuo account:
--
--   update profiles
--   set role = 'admin', approved_at = now()
--   where id = (select id from auth.users where email = 'andrea@altogardakite.it');
--
-- (decommenta il blocco se vuoi farlo subito; commentato per sicurezza)

-- update profiles
--   set role = 'admin', approved_at = now()
--   where id = (select id from auth.users where email = 'TUA_EMAIL_QUI');
