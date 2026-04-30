-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Schema Database
-- ============================================================================
-- Migrazione iniziale: anagrafica soci, attrezzatura, uscite barca, corsi
-- ============================================================================

-- Estensioni
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

create type boat_type as enum ('nuova_jolly', 'lomac', 'pontoon');
create type wind_session as enum ('peler', 'ora', 'ora_serale');
create type instructor_role as enum ('istruttore', 'assistente', 'direttore');
create type equipment_type as enum (
  'kite', 'tavola', 'barra', 'trapezio', 'muta', 'giubbotto',
  'casco', 'wing', 'foil', 'sup', 'altro'
);
create type equipment_status as enum ('disponibile', 'in_uso', 'manutenzione', 'dismesso');
create type course_type as enum ('base', 'avanzato', 'wing_foil', 'privato', 'altro');
create type course_status as enum ('attivo', 'completato', 'sospeso', 'annullato');
create type participation_type as enum ('corso', 'lift_supervisionato', 'lift_semplice');
create type rental_type as enum (
  'nessuno',
  'completo',
  'solo_tavola',
  'solo_kite',
  'solo_barra',
  'solo_trapezio',
  'solo_muta',
  'solo_giubbotto',
  'wing_completo',
  'altro'
);

-- ============================================================================
-- SOCI (Members)
-- ============================================================================
create table members (
  id uuid primary key default uuid_generate_v4(),
  membership_number serial unique,

  -- Dati anagrafici principali
  first_name text not null,
  last_name text not null,
  birth_date date not null,
  birth_place text not null,
  birth_province text,
  fiscal_code text unique,
  phone text,
  email text,

  -- Residenza
  address_street text,
  address_number text,
  city text,
  cap text,

  -- Minore: se true, popolare i campi parent_*
  is_minor boolean not null default false,
  parent_first_name text,
  parent_last_name text,
  parent_birth_date date,
  parent_birth_place text,
  parent_fiscal_code text,
  parent_address_street text,
  parent_address_number text,
  parent_city text,
  parent_cap text,
  parent_phone text,
  parent_email text,

  -- Dichiarazioni di accettazione (boolean)
  statute_accepted boolean not null default false,
  medical_certificate boolean not null default false,
  payment_commitment boolean not null default false,
  photo_authorization boolean not null default false,
  navigation_rules_accepted boolean not null default false,
  safeguarding_acknowledged boolean not null default false,

  -- GDPR Consent
  gdpr_consent_1a boolean not null default false, -- Trattamento dati per finalita istituzionali
  gdpr_consent_1b boolean not null default false, -- Comunicazioni promozionali CONI

  -- Firme (base64 PNG da signature pad)
  signature_admission text,         -- Firma domanda ammissione
  signature_navigation text,        -- Firma informativa navigazione
  signature_safeguarding text,      -- Firma safeguarding
  signature_gdpr_1a text,
  signature_gdpr_1b text,

  -- Documenti caricati (path Supabase Storage)
  medical_certificate_url text,
  identity_document_url text,

  -- Stato
  active boolean not null default true,
  notes text,

  -- Metadati
  registered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_members_last_name on members(last_name);
create index idx_members_email on members(email);
create index idx_members_active on members(active);

-- ============================================================================
-- ISTRUTTORI E ASSISTENTI
-- ============================================================================
create table instructors (
  id uuid primary key default uuid_generate_v4(),
  first_name text not null,
  last_name text not null,
  role instructor_role not null default 'istruttore',
  fiv_certified boolean not null default false,
  certifications text[],
  phone text,
  email text,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_instructors_active on instructors(active);

-- ============================================================================
-- IMBARCAZIONI
-- ============================================================================
create table boats (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  boat_type boat_type not null,
  registration text,
  capacity int,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

-- Seed iniziale imbarcazioni
insert into boats (name, boat_type) values
  ('Nuova Jolly', 'nuova_jolly'),
  ('Lomac', 'lomac'),
  ('Pontoon', 'pontoon');

-- ============================================================================
-- ATTREZZATURA
-- ============================================================================
create table equipment (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,             -- codice interno es. "K-001"
  equipment_type equipment_type not null,
  brand text,
  model text,
  size text,                              -- es. "9m", "138x42", "M", "L"
  year int,
  serial_number text,
  status equipment_status not null default 'disponibile',
  purchase_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_equipment_status on equipment(status);
create index idx_equipment_type on equipment(equipment_type);

-- ============================================================================
-- CORSI
-- ============================================================================
create table courses (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid not null references members(id) on delete restrict,
  course_type course_type not null,
  status course_status not null default 'attivo',
  start_date date not null,
  end_date date,
  hours_total numeric(5,2) not null default 0,
  hours_completed numeric(5,2) not null default 0,
  price numeric(10,2),
  paid boolean not null default false,
  payment_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_courses_member on courses(member_id);
create index idx_courses_status on courses(status);

-- ============================================================================
-- USCITE IN BARCA
-- ============================================================================
create table outings (
  id uuid primary key default uuid_generate_v4(),
  outing_date date not null,
  boat_id uuid not null references boats(id),
  departure_time time,
  return_time time,
  wind_session wind_session,             -- peler / ora / ora_serale
  weather_notes text,
  notes text,
  created_by uuid,                       -- auth.users id
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_outings_date on outings(outing_date desc);
create index idx_outings_boat on outings(boat_id);

-- Istruttori/assistenti su una uscita (M:N)
create table outing_instructors (
  outing_id uuid not null references outings(id) on delete cascade,
  instructor_id uuid not null references instructors(id) on delete restrict,
  role instructor_role,
  primary key (outing_id, instructor_id)
);

-- Partecipanti alla uscita
create table outing_participants (
  id uuid primary key default uuid_generate_v4(),
  outing_id uuid not null references outings(id) on delete cascade,
  member_id uuid not null references members(id) on delete restrict,

  -- Tipo di partecipazione
  participation_type participation_type not null,
  course_id uuid references courses(id),  -- se participation_type = 'corso'

  -- Noleggio
  rental_type rental_type not null default 'nessuno',
  rental_price numeric(10,2),

  -- Note specifiche partecipante
  notes text,

  created_at timestamptz not null default now(),

  -- Un socio non puo partecipare due volte alla stessa uscita
  unique (outing_id, member_id)
);

create index idx_outing_participants_outing on outing_participants(outing_id);
create index idx_outing_participants_member on outing_participants(member_id);

-- Attrezzatura usata da un partecipante (M:N)
create table outing_participant_equipment (
  outing_participant_id uuid not null references outing_participants(id) on delete cascade,
  equipment_id uuid not null references equipment(id) on delete restrict,
  primary key (outing_participant_id, equipment_id)
);

-- ============================================================================
-- TRIGGER: aggiornamento updated_at
-- ============================================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_members_updated_at before update on members
  for each row execute procedure set_updated_at();
create trigger trg_instructors_updated_at before update on instructors
  for each row execute procedure set_updated_at();
create trigger trg_equipment_updated_at before update on equipment
  for each row execute procedure set_updated_at();
create trigger trg_courses_updated_at before update on courses
  for each row execute procedure set_updated_at();
create trigger trg_outings_updated_at before update on outings
  for each row execute procedure set_updated_at();

-- ============================================================================
-- VIEW: Vista uscite con dettagli aggregati
-- ============================================================================
create or replace view outings_with_details as
select
  o.*,
  b.name as boat_name,
  b.boat_type,
  (select count(*) from outing_participants op where op.outing_id = o.id) as participants_count,
  (select count(*) from outing_instructors oi where oi.outing_id = o.id) as instructors_count
from outings o
join boats b on b.id = o.boat_id;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Per ora abilitiamo RLS ma con policy permissive per utenti autenticati.
-- In produzione affinare per ruolo (admin, istruttore, segreteria).

alter table members enable row level security;
alter table instructors enable row level security;
alter table boats enable row level security;
alter table equipment enable row level security;
alter table courses enable row level security;
alter table outings enable row level security;
alter table outing_instructors enable row level security;
alter table outing_participants enable row level security;
alter table outing_participant_equipment enable row level security;

-- Policy: utenti autenticati hanno accesso completo (staff scuola)
create policy "auth_all_members" on members for all to authenticated using (true) with check (true);
create policy "auth_all_instructors" on instructors for all to authenticated using (true) with check (true);
create policy "auth_all_boats" on boats for all to authenticated using (true) with check (true);
create policy "auth_all_equipment" on equipment for all to authenticated using (true) with check (true);
create policy "auth_all_courses" on courses for all to authenticated using (true) with check (true);
create policy "auth_all_outings" on outings for all to authenticated using (true) with check (true);
create policy "auth_all_outing_instructors" on outing_instructors for all to authenticated using (true) with check (true);
create policy "auth_all_outing_participants" on outing_participants for all to authenticated using (true) with check (true);
create policy "auth_all_outing_participant_equipment" on outing_participant_equipment for all to authenticated using (true) with check (true);

-- ============================================================================
-- STORAGE BUCKETS (eseguire da dashboard Supabase o via API)
-- ============================================================================
-- 1. Bucket "documents" (privato): certificati medici, documenti identita
-- 2. Bucket "signatures" (privato): backup firme se non si vogliono inline base64
