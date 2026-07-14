'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ScrollText, Loader2, CalendarPlus, Users, Sailboat, UserX, Shield, ListFilter,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface LogEntry {
  id: string;
  created_at: string;
  actor_name: string | null;
  action: string;
  description: string;
}

const CATEGORIES = [
  { value: '', label: 'Tutto' },
  { value: 'booking', label: 'Prenotazioni' },
  { value: 'outing', label: 'Uscite' },
  { value: 'member', label: 'Soci' },
  { value: 'absence', label: 'Assenze' },
  { value: 'user', label: 'Utenti' },
];

function actionIcon(action: string) {
  if (action.startsWith('booking')) return CalendarPlus;
  if (action.startsWith('outing')) return Sailboat;
  if (action.startsWith('member')) return Users;
  if (action.startsWith('absence')) return UserX;
  if (action.startsWith('user')) return Shield;
  return ScrollText;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  }) + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

export default function LogView() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [category, setCategory] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cat: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/log${cat ? `?category=${cat}` : ''}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');
      setEntries(data.entries || []);
      setHasMore(data.hasMore || false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(category); }, [category, load]);

  async function loadMore() {
    if (entries.length === 0) return;
    setLoadingMore(true);
    try {
      const before = encodeURIComponent(entries[entries.length - 1].created_at);
      const res = await fetch(`/api/log?before=${before}${category ? `&category=${category}` : ''}`);
      const data = await res.json();
      if (res.ok) {
        setEntries((prev) => [...prev, ...(data.entries || [])]);
        setHasMore(data.hasMore || false);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="p-4 lg:p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-3">
          <ScrollText className="h-7 w-7 text-accent" />
          Registro attivit&agrave;
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Chi ha fatto cosa nell&apos;app, dal pi&ugrave; recente.
        </p>
      </div>

      {/* Filtro categoria */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <ListFilter className="h-4 w-4 text-text-dim" />
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            className={cn(
              'px-3 py-1 rounded-full text-xs border transition-colors',
              category === c.value
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border text-text-muted hover:border-text-dim'
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 rounded border border-red-500/30 bg-red-500/5 text-sm text-red-400 mb-4">
          {error}
          {error.includes('activity_log') && (
            <span className="block text-xs mt-1 text-text-muted">
              Probabilmente manca la migration 0023 sul database.
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-text-muted">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="p-8 text-center bg-bg-surface border border-border rounded-lg text-sm text-text-dim">
          Nessun evento registrato{category ? ' per questa categoria' : ''} (il registro parte da oggi: gli eventi passati non sono recuperabili).
        </div>
      ) : (
        <div className="space-y-1.5">
          {entries.map((e) => {
            const Icon = actionIcon(e.action);
            return (
              <div
                key={e.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-border bg-bg-surface"
              >
                <Icon className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-text">{e.description}</div>
                  <div className="text-[11px] text-text-dim mt-0.5">
                    {e.actor_name || 'Sistema'} · {formatWhen(e.created_at)}
                  </div>
                </div>
              </div>
            );
          })}

          {hasMore && (
            <div className="pt-3 text-center">
              <Button variant="secondary" onClick={loadMore} disabled={loadingMore}>
                {loadingMore && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Carica altri
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
