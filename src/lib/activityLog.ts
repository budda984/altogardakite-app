import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthState } from '@/lib/auth';

/**
 * Registra un evento nel registro attivita. Best effort:
 * se fallisce non blocca mai l'operazione principale.
 *
 * Esempi di action: 'booking.create', 'booking.delete', 'booking.waitlist',
 * 'member.create', 'outing.create', 'outing.cancel', 'absence.create',
 * 'user.approve', ...
 */
export async function logActivity(
  supabase: SupabaseClient,
  auth: AuthState | null,
  action: string,
  description: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from('activity_log').insert({
      actor_id: auth?.userId || null,
      actor_name: auth?.profile?.display_name || auth?.email || null,
      action,
      description,
      metadata: metadata || null,
    });
  } catch {
    // mai bloccare l'operazione principale per un errore di log
  }
}
