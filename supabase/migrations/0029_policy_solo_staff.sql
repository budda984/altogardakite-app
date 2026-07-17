-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0029
-- Chiude tre policy che si fidavano di chiunque fosse autenticato.
-- ============================================================================
-- PERCHE'
--   Fino alla 0024 gli unici utenti autenticati erano lo staff, quindi
--   "for all to authenticated using (true)" voleva dire "staff". Con la 0025
--   sono arrivati i soci: da quel momento quelle policy vogliono dire
--   "chiunque abbia un account".
--
--   Verificato su Postgres: un socio semplice riusciva a
--     - leggere activity_log (nomi e telefoni nelle descrizioni)
--     - leggere e CANCELLARE instructor_absences
--     - leggere e CANCELLARE planner_drafts (i nomi di chi esce)
--
--   Le policy della 0001 non c'entrano: la 0003 le aveva gia' sostituite con
--   is_active_staff(). Il buco riguarda solo le tre tabelle nate dopo.
--
-- EFFETTO SUL GESTIONALE: nessuno. Lo staff passa is_active_staff() e
-- continua a fare esattamente quello che faceva.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- activity_log
-- ----------------------------------------------------------------------------
drop policy if exists "activity_log_select" on activity_log;
drop policy if exists "activity_log_insert" on activity_log;

create policy "staff_select_activity_log" on activity_log
  for select to authenticated using (is_active_staff());

create policy "staff_insert_activity_log" on activity_log
  for insert to authenticated with check (is_active_staff());


-- ----------------------------------------------------------------------------
-- instructor_absences
-- ----------------------------------------------------------------------------
drop policy if exists "instructor_absences_select" on instructor_absences;
drop policy if exists "instructor_absences_insert" on instructor_absences;
drop policy if exists "instructor_absences_delete" on instructor_absences;

create policy "staff_select_instructor_absences" on instructor_absences
  for select to authenticated using (is_active_staff());

create policy "staff_insert_instructor_absences" on instructor_absences
  for insert to authenticated with check (is_active_staff());

create policy "staff_delete_instructor_absences" on instructor_absences
  for delete to authenticated using (is_active_staff());


-- ----------------------------------------------------------------------------
-- planner_drafts
-- ----------------------------------------------------------------------------
drop policy if exists "planner_drafts_select" on planner_drafts;
drop policy if exists "planner_drafts_insert" on planner_drafts;
drop policy if exists "planner_drafts_update" on planner_drafts;
drop policy if exists "planner_drafts_delete" on planner_drafts;

create policy "staff_select_planner_drafts" on planner_drafts
  for select to authenticated using (is_active_staff());

create policy "staff_insert_planner_drafts" on planner_drafts
  for insert to authenticated with check (is_active_staff());

create policy "staff_update_planner_drafts" on planner_drafts
  for update to authenticated using (is_active_staff()) with check (is_active_staff());

create policy "staff_delete_planner_drafts" on planner_drafts
  for delete to authenticated using (is_active_staff());
