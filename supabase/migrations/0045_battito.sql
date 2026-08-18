-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0045
-- Battito: tiene il progetto Supabase fuori dalla pausa per inattivita'.
-- ============================================================================
-- Sul piano gratuito Supabase mette in pausa i progetti che restano inattivi
-- per 7 giorni. Fuori stagione il gestionale puo' non essere aperto per
-- settimane: senza un segnale di vita il database si ferma e va riattivato
-- a mano dal pannello.
--
-- Il controllo vento (gia' schedulato ogni sera) scrive qui una riga: e'
-- sufficiente a far ripartire il conteggio dei 7 giorni.
-- La funzione tiene solo le ultime 30 righe, cosi' la tabella non cresce.
--
-- Additiva: una tabella e una funzione, non tocca nulla di esistente.
-- ============================================================================

create table if not exists portale.battito (
  id         bigserial primary key,
  quando     timestamptz not null default now(),
  nota       text
);

alter table portale.battito enable row level security;

-- Nessun socio deve vederla: solo lo staff, per curiosita' diagnostica.
create policy "staff_legge_battito" on portale.battito
  for select to authenticated
  using (is_active_staff());

grant select on portale.battito to authenticated;

-- Il cron gira con la service role.
grant select, insert, delete on portale.battito to service_role;
grant usage, select on sequence portale.battito_id_seq to service_role;

-- Scrive il battito e fa pulizia: restano le ultime 30 righe.
create or replace function portale.battito_segna(p_nota text default null)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quando timestamptz;
begin
  insert into portale.battito (nota) values (p_nota)
  returning quando into v_quando;

  delete from portale.battito
   where id not in (
     select id from portale.battito order by id desc limit 30
   );

  return v_quando;
end;
$$;

revoke all on function portale.battito_segna(text) from public;
grant execute on function portale.battito_segna(text) to service_role;
grant execute on function portale.battito_segna(text) to authenticated;
