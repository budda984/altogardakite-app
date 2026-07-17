import { createClient } from '@/lib/supabase/server';
import type { Profile, UserRole } from '@/lib/types';

export interface AuthState {
  userId: string;
  email: string | null;
  profile: Profile | null;
  role: UserRole;
  isStaff: boolean;
  isAdmin: boolean;
}

/**
 * Recupera l'utente corrente con il suo ruolo. Use in server components/actions.
 * Ritorna null se non autenticato.
 */
export async function getAuth(): Promise<AuthState | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const role = (profile?.role || 'pending') as UserRole;
  const suspended = profile?.suspended === true;
  const isStaff = (role === 'staff' || role === 'admin') && !suspended;
  const isAdmin = role === 'admin' && !suspended;

  return {
    userId: user.id,
    email: user.email || null,
    profile: profile as Profile | null,
    role,
    isStaff,
    isAdmin,
  };
}
