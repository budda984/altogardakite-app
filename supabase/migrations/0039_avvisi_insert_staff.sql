-- ============================================================================
-- CIRCOLO ALTOGARDA KITE ASD - Migration 0039
-- Lo staff puo' inserire avvisi direttamente.
-- ============================================================================
-- La 0026 concedeva ad authenticated solo select e update su portale.avvisi:
-- gli inserimenti passavano tutti da funzioni security definer. Il tester
-- delle notifiche push (pagina Richieste) inserisce invece un avviso di
-- prova con il client dello staff, e serve il privilegio di insert.
--
-- Sicurezza invariata: con RLS attiva l'insert passa solo se una policy lo
-- consente, e l'unica policy di insert e' staff_all_avvisi (is_active_staff).
-- Un socio autenticato resta bloccato come prima.
-- ============================================================================

grant insert on portale.avvisi to authenticated;
