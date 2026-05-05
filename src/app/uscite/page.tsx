import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Plus, ChevronRight, Sailboat, Wind, Users } from 'lucide-react';
import { formatDate, formatTime } from '@/lib/utils';
import { WIND_SESSION_LABELS } from '@/lib/types';

export default async function OutingsListPage() {
  const supabase = await createClient();
  const { data: outings, error } = await supabase
    .from('outings_with_details')
    .select('*')
    .order('outing_date', { ascending: false })
    .order('departure_time', { ascending: false });

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <div className="text-xs uppercase tracking-widest text-text-dim mb-2">Registro</div>
          <h1 className="font-display text-3xl lg:text-4xl font-bold tracking-tightest">
            Uscite barca
          </h1>
          <p className="mt-2 text-text-muted text-sm">
            {outings?.length ?? 0} uscite registrate
          </p>
        </div>
        <Link
          href="/uscite/nuova"
          className="inline-flex items-center gap-2 bg-accent text-bg px-4 py-2.5 rounded-md text-sm font-medium hover:bg-accent-hover transition-colors self-start"
        >
          <Plus className="h-4 w-4" /> Nuova uscita
        </Link>
      </header>

      {error && (
        <div className="bg-danger/10 border border-danger/30 text-danger p-4 rounded-md">
          {error.message}
        </div>
      )}

      {outings && outings.length === 0 && (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <Sailboat className="h-8 w-8 text-text-dim mx-auto mb-3" />
          <div className="text-text-muted text-sm mb-4">Nessuna uscita registrata</div>
          <Link href="/uscite/nuova" className="inline-flex items-center gap-2 text-accent hover:underline text-sm">
            Registra la prima <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {outings && outings.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {outings.map((o: any) => (
            <Link
              key={o.id}
              href={`/uscite/${o.id}`}
              className="group rounded-lg border border-border bg-bg-surface p-5 hover:border-accent/50 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-xs text-text-dim">{formatDate(o.outing_date)}</div>
                  <div className="font-display text-lg font-semibold tracking-tight mt-0.5">
                    {o.boat_name}
                  </div>
                </div>
                {o.wind_session && (
                  <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-accent/10 text-accent">
                    {WIND_SESSION_LABELS[o.wind_session as keyof typeof WIND_SESSION_LABELS]}
                  </span>
                )}
              </div>

              <div className="space-y-1.5 text-xs text-text-muted">
                <div className="flex items-center gap-2">
                  <Wind className="h-3.5 w-3.5" />
                  {formatTime(o.departure_time)} → {formatTime(o.return_time)}
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" />
                  {o.participants_count} partecipanti • {o.instructors_count} istruttori
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
