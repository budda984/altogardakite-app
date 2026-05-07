-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0016
-- Estende outings_with_details con istruttori concatenati per visualizzazione
-- in lista uscite (vista compatta).
-- ============================================================================

drop view if exists outings_with_details;

create view outings_with_details as
select
  o.*,
  b.name as boat_name,
  b.boat_type,
  (select count(*) from outing_participants op where op.outing_id = o.id) as participants_count,
  (select count(*) from outing_instructors oi where oi.outing_id = o.id) as instructors_count,
  (
    select string_agg(i.first_name || ' ' || left(i.last_name, 1) || '.', ', ' order by i.last_name)
      from outing_instructors oi
      join instructors i on i.id = oi.instructor_id
      where oi.outing_id = o.id
  ) as instructor_names
from outings o
left join boats b on b.id = o.boat_id;
