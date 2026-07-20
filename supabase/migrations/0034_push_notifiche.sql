-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0034
-- Notifiche push: iscrizioni dei dispositivi + coda di invio.
-- ============================================================================
-- COME FUNZIONA
--   1. Il socio, dal portale, concede il permesso: il browser crea una
--      "subscription" (endpoint + chiavi) che salviamo qui.
--   2. Quando nasce un avviso (portale.avvisi), un trigger mette una riga
--      in push_coda.
--   3. Un endpoint dell'app (chiamato da un cron o dal webhook) legge la
--      coda e spedisce via Web Push con le chiavi VAPID.
--
--   La coda serve perche' il trigger SQL non puo' fare una chiamata HTTP:
--   separa "e' successo qualcosa" (istantaneo, nel db) da "spedisco la
--   notifica" (fuori, con la libreria web-push).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. ISCRIZIONI DEI DISPOSITIVI
-- Un socio puo' avere piu' dispositivi (telefono + tablet): una riga each.
-- ----------------------------------------------------------------------------
create table if not exists portale.push_iscrizioni (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references members(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_ok_at  timestamptz
);

create index if not exists idx_push_iscr_member on portale.push_iscrizioni(member_id);

alter table portale.push_iscrizioni enable row level security;

-- Il socio gestisce solo le proprie iscrizioni.
create policy "socio_gestisce_push" on portale.push_iscrizioni
  for all to authenticated
  using (member_id = portale.socio_member_id())
  with check (member_id = portale.socio_member_id());

-- Lo staff non tocca le iscrizioni dei soci: l'invio passa dalla service
-- role key lato server, che scavalca RLS. Nessuna policy staff qui.

grant select, insert, update, delete on portale.push_iscrizioni to authenticated;


-- ----------------------------------------------------------------------------
-- 2. LA CODA DI INVIO
-- Una riga per ogni avviso da spedire. Lo stato evita doppioni e permette
-- di ritentare.
-- ----------------------------------------------------------------------------
create table if not exists portale.push_coda (
  id          bigint generated always as identity primary key,
  avviso_id   uuid not null references portale.avvisi(id) on delete cascade,
  member_id   uuid not null references members(id) on delete cascade,
  stato       text not null default 'in_attesa'
              check (stato in ('in_attesa', 'inviato', 'fallito')),
  tentativi   int not null default 0,
  ultimo_errore text,
  created_at  timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_push_coda_da_fare
  on portale.push_coda(created_at) where stato = 'in_attesa';

alter table portale.push_coda enable row level security;
-- Nessuna policy: ci accede solo il server con la service role key.
-- Il socio non deve vedere la coda di invio.


-- ----------------------------------------------------------------------------
-- 3. IL TRIGGER: ogni avviso nuovo entra in coda
-- ----------------------------------------------------------------------------
create or replace function portale.avviso_in_coda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo se il socio ha almeno un dispositivo iscritto: inutile accodare
  -- notifiche per chi non le riceve.
  if exists (select 1 from portale.push_iscrizioni where member_id = new.member_id) then
    insert into portale.push_coda (avviso_id, member_id)
    values (new.id, new.member_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_avviso_in_coda on portale.avvisi;
create trigger trg_avviso_in_coda
  after insert on portale.avvisi
  for each row execute function portale.avviso_in_coda();


-- ----------------------------------------------------------------------------
-- 4. LETTURA DELLA CODA (per il servizio di invio)
-- Ritorna gli avvisi da spedire, gia' uniti a testo e dispositivi.
-- SECURITY DEFINER: chiamata dal server con la service role key.
-- ----------------------------------------------------------------------------
create or replace function portale.push_da_inviare(p_limite int default 50)
returns table (
  coda_id     bigint,
  avviso_id   uuid,
  titolo      text,
  corpo       text,
  tipo        text,
  endpoint    text,
  p256dh      text,
  auth        text,
  iscrizione_id uuid
)
language sql
security definer
set search_path = public
as $$
  select c.id, a.id, a.titolo, a.corpo, a.tipo,
         i.endpoint, i.p256dh, i.auth, i.id
    from portale.push_coda c
    join portale.avvisi a on a.id = c.avviso_id
    join portale.push_iscrizioni i on i.member_id = c.member_id
   where c.stato = 'in_attesa'
   order by c.created_at
   limit p_limite;
$$;

-- Segna l'esito di una riga della coda.
create or replace function portale.push_esito(
  p_coda_id bigint,
  p_ok boolean,
  p_errore text default null
) returns void
language sql
security definer
set search_path = public
as $$
  update portale.push_coda
     set stato = case when p_ok then 'inviato' else 'fallito' end,
         tentativi = tentativi + 1,
         ultimo_errore = p_errore,
         processed_at = now()
   where id = p_coda_id;
$$;

-- Rimuove un'iscrizione morta (il browser risponde 410 Gone).
create or replace function portale.push_rimuovi_iscrizione(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from portale.push_iscrizioni where id = p_id;
$$;
