import { redirect } from 'next/navigation';
import { Inbox } from 'lucide-react';
import { getAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import RichiesteList from './RichiesteList';
import type { RichiestaDaRispondere } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function RichiestePage() {
  const auth = await getAuth();
  if (!auth || !auth.isStaff) redirect('/');

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('bookings_da_rispondere')
    .select('*');

  const richieste = (data || []) as RichiestaDaRispondere[];

  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  const domani = new Date(oggi);
  domani.setDate(domani.getDate() + 1);

  // Quante scadono stasera: ai soci abbiamo promesso una risposta entro la
  // sera prima. Questo numero e' la promessa che stai per mancare.
  const urgenti = richieste.filter((r) => {
    const g = new Date(r.booking_date + 'T00:00:00');
    return g.getTime() <= domani.getTime();
  }).length;

  return (
    <div className="p-6 lg:p-10 max-w-4xl pb-24 lg:pb-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-3">
          <Inbox className="h-7 w-7 text-accent" />
          Richieste
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Prenotazioni arrivate dal portale soci. Accettare tiene il posto: la barca e
          l&apos;istruttore li decidi dopo, nel planning.
        </p>
      </div>

      {error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm">
          <p className="font-medium text-red-400">Non riesco a leggere le richieste</p>
          <p className="text-text-muted mt-1">{error.message}</p>
          <p className="text-text-muted mt-2 text-xs">
            Se il messaggio parla di una relazione che non esiste, mancano le migration
            0028 e 0030 su questo database.
          </p>
        </div>
      ) : (
        <>
          {urgenti > 0 && (
            <div className="mb-6 flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
              <span className="font-display text-2xl font-bold text-amber-400 leading-none">
                {urgenti}
              </span>
              <p className="text-sm text-text-muted">
                {urgenti === 1 ? 'richiesta è' : 'richieste sono'} per domani o per oggi.
                Ai soci abbiamo promesso una risposta entro la sera prima.
              </p>
            </div>
          )}

          <RichiesteList richieste={richieste} />
        </>
      )}
    </div>
  );
}
