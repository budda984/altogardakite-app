import { Clock, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function AttesaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, display_name, suspended')
    .eq('id', user.id)
    .single();

  // Se e' gia stato approvato (staff/admin) e non sospeso, manda alla home
  if (profile && (profile.role === 'staff' || profile.role === 'admin') && !profile.suspended) {
    redirect('/');
  }

  const isSuspended = profile?.suspended === true;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg">
      <div className="w-full max-w-md text-center">
        <div className="font-display text-2xl font-bold tracking-tightest leading-none mb-1">
          ALTO<span className="text-accent">GARDA</span>
        </div>
        <div className="font-display text-2xl font-bold tracking-tightest leading-none">
          KITE
        </div>

        <div className="bg-bg-surface border border-border rounded-lg p-8 mt-8 space-y-4">
          {isSuspended ? (
            <>
              <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-red-400" />
              </div>
              <h1 className="font-display text-xl font-semibold tracking-tight">Account sospeso</h1>
              <p className="text-sm text-text-muted">
                Il tuo account e stato sospeso da un amministratore.
                Contatta lo staff del Circolo Altogarda Kite per chiarimenti.
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <Clock className="h-8 w-8 text-amber-400" />
              </div>
              <h1 className="font-display text-xl font-semibold tracking-tight">In attesa di approvazione</h1>
              <p className="text-sm text-text-muted">
                Ciao {profile?.display_name || user.email}, il tuo account e stato creato correttamente.
              </p>
              <p className="text-sm text-text-muted">
                Per accedere al gestionale serve l&apos;approvazione di un amministratore.
                Riceverai conferma quando il tuo account sara abilitato.
              </p>
            </>
          )}

          <form action="/api/auth/logout" method="post" className="pt-4 border-t border-border">
            <button
              type="submit"
              className="text-xs text-text-muted hover:text-text underline"
            >
              Esci
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
