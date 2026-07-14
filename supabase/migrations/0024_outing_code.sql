-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0024
-- Codice identificativo uscita: DATA-SIGLABARCA-SIGLAISTRUTTORE-PROGRESSIVO
-- es. 20260714-LAG-MB-02
-- La sigla e' generata dalle iniziali/prime lettere del nome.
-- Il codice viene assegnato dall'applicazione alla creazione dell'uscita.
-- ============================================================================

alter table outings
  add column if not exists code text;

-- Funzione: sigla da un testo (parola singola -> prime 3 lettere;
-- piu' parole -> iniziali). Sempre maiuscolo, solo lettere.
create or replace function agk_sigla(input text)
returns text
language plpgsql
immutable
as $$
declare
  cleaned text;
  words text[];
  result text;
begin
  if input is null or trim(input) = '' then
    return 'XX';
  end if;
  -- tieni solo lettere e spazi
  cleaned := regexp_replace(input, '[^a-zA-Z ]', '', 'g');
  cleaned := trim(regexp_replace(cleaned, '\s+', ' ', 'g'));
  words := string_to_array(cleaned, ' ');

  if array_length(words, 1) is null then
    return 'XX';
  elsif array_length(words, 1) = 1 then
    -- parola singola: prime 3 lettere
    result := upper(left(words[1], 3));
  else
    -- piu' parole: iniziali (max 3)
    result := '';
    for i in 1..least(array_length(words, 1), 3) loop
      result := result || upper(left(words[i], 1));
    end loop;
  end if;

  return result;
end;
$$;

-- Funzione: genera il codice completo per un'uscita gia' creata.
-- Usa la barca, il PRIMO istruttore (per last_name) e il progressivo del giorno.
create or replace function agk_genera_codice_uscita(p_outing_id uuid)
returns text
language plpgsql
as $$
declare
  v_date date;
  v_boat_name text;
  v_instr_name text;
  v_seq int;
  v_code text;
begin
  select o.outing_date, b.name
    into v_date, v_boat_name
    from outings o
    left join boats b on b.id = o.boat_id
    where o.id = p_outing_id;

  if v_date is null then
    return null;
  end if;

  -- primo istruttore (ordinato per cognome)
  select i.first_name || ' ' || i.last_name
    into v_instr_name
    from outing_instructors oi
    join instructors i on i.id = oi.instructor_id
    where oi.outing_id = p_outing_id
    order by i.last_name
    limit 1;

  -- progressivo del giorno: quante uscite gia' hanno un codice in quella data
  select count(*) + 1
    into v_seq
    from outings o
    where o.outing_date = v_date
      and o.code is not null
      and o.id <> p_outing_id;

  v_code := to_char(v_date, 'YYYYMMDD')
    || '-' || agk_sigla(v_boat_name)
    || '-' || coalesce(agk_sigla(v_instr_name), 'XX')
    || '-' || lpad(v_seq::text, 2, '0');

  update outings set code = v_code where id = p_outing_id;
  return v_code;
end;
$$;
