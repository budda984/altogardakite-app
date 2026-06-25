import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  Plus, ChevronRight, Sailboat, Wind, Users, Lock, Unlock, XCircle,
  Filter, Calendar,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { DISCIPLINE_LABELS } from '@/lib/types';

export default async function OutingsListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from('outings_with_details')
    .select('*')
    .order('outing_date', { ascending: false })
    .order('departure_time', { ascending: false });

  if (status === 'bozza' || status === 'chiusa' || status === 'annullata') {
    query = query.eq('status', status);
  }

  const { data: outings, error } = await query;

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-text-dim mb-2">Registro</div>
          <h1 className="font-display text-3xl lg:text-4xl font-bold tracking-tightest">
            Uscite
          </h1>
          <p className="mt-2 text-text-muted text-sm">
            {outings?.length ?? 0} {outings?.length === 1 ? 'uscita' : 'uscite'}
            {status ? ` (filtro: ${status})` : ' totali'}
          </p>
        </div>
        <Link
          href="/uscite/nuova"
          className="inline-flex items-center gap-2 bg-accent text-bg px-4 py-2.5 rounded-md text-sm font-medium hover:bg-accent-hover transition-colors self-start"
        >
          <Plus className="h-4 w-4" /> Nuova uscita
        </Link>
      </header>

      {/* Filtri rapidi */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        <Link
          href="/uscite"
          className={`text-xs px-2.5 py-1 rounded ${!status ? 'bg-accent text-bg' : 'bg-bg-elevated text-text-muted hover:text-text border border-border'}`}
        >
          Tutte
        </Link>
        <Link
          href="/uscite?status=bozza"
          className={`text-xs px-2.5 py-1 rounded inline-flex items-center gap-1 ${status === 'bozza' ? 'bg-amber-500 text-bg' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/15'}`}
        >
          <Unlock className="h-3 w-3" /> Bozza
        </Link>
        <Link
          href="/uscite?status=chiusa"
          className={`text-xs px-2.5 py-1 rounded inline-flex items-center gap-1 ${status === 'chiusa' ? 'bg-emerald-500 text-bg' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/15'}`}
        >
          <Lock className="h-3 w-3" /> Chiusa
        </Link>
        <Link
          href="/uscite?status=annullata"
          className={`text-xs px-2.5 py-1 rounded inline-flex items-center gap-1 ${status === 'annullata' ? 'bg-red-500 text-white' : 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/15'}`}
        >
          <XCircle className="h-3 w-3" /> Annullata
        </Link>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/30 text-danger p-4 rounded-md mb-4">
          {error.message}
        </div>
      )}

      {outings && outings.length === 0 && (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <Sailboat className="h-8 w-8 text-text-dim mx-auto mb-3" />
          <div className="text-text-muted text-sm mb-4">Nessuna uscita</div>
          {!status && (
            <Link href="/uscite/nuova" className="inline-flex items-center gap-2 text-accent hover:underline text-sm">
              Registra la prima <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      )}

      {outings && outings.length > 0 && (
        <div className="rounded-lg border border-border bg-bg-surface overflow-hidden">
          {/* Header tabella desktop */}
          <div className="hidden md:grid grid-cols-[100px_1.5fr_1fr_1fr_60px_100px_30px] gap-3 px-4 py-2.5 border-b border-border text-[10px] uppercase tracking-wider text-text-dim font-medium">
            <div>Data</div>
            <div>Barca / Disciplina</div>
            <div>Orario</div>
            <div>Istruttori</div>
            <div className="text-center">Part.</div>
            <div>Stato</div>
            <div></div>
          </div>

          <div className="divide-y divide-border">
            {outings.map((o) => (
              <Link
                key={o.id}
                href={`/uscite/${o.id}`}
                className={`block hover:bg-bg-elevated transition-colors ${
                  o.status === 'annullata' ? 'opacity-60' : ''
                }`}
              >
                {/* Vista DESKTOP: tabella */}
                <div className="hidden md:grid grid-cols-[100px_1.5fr_1fr_1fr_60px_100px_30px] gap-3 px-4 py-2.5 items-center text-sm">
                  <div className="text-xs text-text-muted font-mono">
                    {formatDate(o.outing_date)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-text flex items-center gap-1.5 truncate">
                      <Sailboat className="h-3.5 w-3.5 text-accent shrink-0" />
                      <span className={o.status === 'annullata' ? 'line-through' : ''}>
                        {o.boat_name || '?'}
                      </span>
                    </div>
                    <div className="text-[10px] text-text-dim truncate">
                      {o.discipline ? DISCIPLINE_LABELS[o.discipline as keyof typeof DISCIPLINE_LABELS] : '—'}
                    </div>
                  </div>
                  <div className="text-xs text-text-muted">
                    {o.departure_time && o.return_time
                      ? `${o.departure_time.slice(0, 5)}–${o.return_time.slice(0, 5)}`
                      : '—'}
                  </div>
                  <div className="text-xs text-text-muted truncate">
                    {o.instructor_names || '—'}
                  </div>
                  <div className="text-center">
                    <span className="inline-flex items-center gap-0.5 text-xs text-text-muted">
                      <Users className="h-3 w-3" />
                      {o.participants_count || 0}
                    </span>
                  </div>
                  <div>
                    <StatusBadge status={o.status} />
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-text-dim" />
                </div>

                {/* Vista MOBILE: card compatta */}
                <div className="md:hidden p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-text-dim font-mono mb-1">
                        {formatDate(o.outing_date)}
                        {o.departure_time && o.return_time && (
                          <span className="ml-2">
                            {o.departure_time.slice(0, 5)}–{o.return_time.slice(0, 5)}
                          </span>
                        )}
                      </div>
                      <div className="font-medium text-text flex items-center gap-1.5">
                        <Sailboat className="h-3.5 w-3.5 text-accent shrink-0" />
                        <span className={o.status === 'annullata' ? 'line-through' : ''}>
                          {o.boat_name || '?'}
                        </span>
                      </div>
                      {o.instructor_names && (
                        <div className="text-[11px] text-text-muted mt-0.5 truncate">
                          {o.instructor_names}
                        </div>
                      )}
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-text-muted mt-1">
                    {o.discipline && (
                      <span>{DISCIPLINE_LABELS[o.discipline as keyof typeof DISCIPLINE_LABELS]}</span>
                    )}
                    <span className="inline-flex items-center gap-0.5">
                      <Users className="h-3 w-3" />
                      {o.participants_count || 0}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'chiusa') {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 inline-flex items-center gap-0.5">
        <Lock className="h-2.5 w-2.5" /> Chiusa
      </span>
    );
  }
  if (status === 'annullata') {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 inline-flex items-center gap-0.5">
        <XCircle className="h-2.5 w-2.5" /> Annullata
      </span>
    );
  }
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 inline-flex items-center gap-0.5">
      <Unlock className="h-2.5 w-2.5" /> Bozza
    </span>
  );
}
