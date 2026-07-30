'use client';

import { useEffect, useState, useCallback } from 'react';
import { StickyNote, Plus, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DateInput } from '@/components/ui/DateInput';

// Note del planning: promemoria dello staff su un intervallo di giorni.
// Appaiono nel planning ogni giorno compreso tra "da" e "a".

type Nota = {
  id: string;
  testo: string;
  data_da: string;
  data_a: string;
  created_by_name: string | null;
};

function giornoIt(g: string) {
  return new Date(`${g}T12:00:00`).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
  });
}

export default function PlanningNote({ date }: { date: string }) {
  const [note, setNote] = useState<Nota[]>([]);
  const [aperto, setAperto] = useState(false);
  const [testo, setTesto] = useState('');
  const [da, setDa] = useState(date);
  const [a, setA] = useState(date);
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const carica = useCallback(async () => {
    try {
      const r = await fetch(`/api/planning/note?date=${date}`);
      const j = await r.json();
      setNote(j.note || []);
    } catch {
      setNote([]);
    }
  }, [date]);

  useEffect(() => {
    carica();
  }, [carica]);

  // Quando cambia il giorno del planning, il form riparte da quel giorno.
  useEffect(() => {
    setDa(date);
    setA(date);
  }, [date]);

  async function salva() {
    if (!testo.trim()) return;
    setBusy(true);
    setErrore(null);
    try {
      const r = await fetch('/api/planning/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testo: testo.trim(), data_da: da, data_a: a }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErrore(j.error || 'Non salvata.');
      } else {
        setTesto('');
        setAperto(false);
        carica();
      }
    } catch {
      setErrore('Non riesco a salvare.');
    } finally {
      setBusy(false);
    }
  }

  async function elimina(id: string) {
    setNote((n) => n.filter((x) => x.id !== id)); // via subito dall'elenco
    try {
      await fetch(`/api/planning/note?id=${id}`, { method: 'DELETE' });
    } catch {
      carica(); // non riuscito: ricarico lo stato vero
    }
  }

  return (
    <div className="bg-bg-surface border border-border rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-text">
          <StickyNote className="h-4 w-4 text-accent" />
          Note del giorno
        </h3>
        {!aperto && (
          <button
            onClick={() => setAperto(true)}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-border text-text-muted hover:text-text hover:border-accent transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Aggiungi
          </button>
        )}
      </div>

      {note.length === 0 && !aperto && (
        <p className="text-xs text-text-dim">Nessuna nota per oggi.</p>
      )}

      {note.length > 0 && (
        <ul className="space-y-2 mb-2">
          {note.map((n) => (
            <li
              key={n.id}
              className="flex items-start justify-between gap-3 text-sm bg-bg-elevated border border-border rounded-md px-3 py-2"
            >
              <div>
                <p className="text-text whitespace-pre-wrap">{n.testo}</p>
                <p className="text-[11px] text-text-dim mt-1">
                  {n.data_da === n.data_a
                    ? giornoIt(n.data_da)
                    : `${giornoIt(n.data_da)} – ${giornoIt(n.data_a)}`}
                  {n.created_by_name ? ` · ${n.created_by_name}` : ''}
                </p>
              </div>
              <button
                onClick={() => elimina(n.id)}
                className="text-text-dim hover:text-danger p-1"
                aria-label="Elimina nota"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {aperto && (
        <div className="mt-1 p-3 rounded-md border border-border bg-bg-elevated">
          <textarea
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            placeholder="Es. Gara sul lago, pontile occupato dalle 14…"
            rows={2}
            maxLength={1000}
            className="w-full text-sm px-3 py-2 rounded-md border border-border bg-bg-surface text-text resize-none focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <div className="grid grid-cols-2 gap-3 mt-3">
            <DateInput label="Da" value={da} onChange={setDa} />
            <DateInput label="A" value={a} onChange={setA} />
          </div>
          {errore && <p className="mt-2 text-xs text-danger">{errore}</p>}
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => {
                setAperto(false);
                setErrore(null);
                setTesto('');
              }}
              className="text-xs px-3 py-1.5 rounded-md text-text-muted hover:text-text inline-flex items-center gap-1"
            >
              <X className="h-3.5 w-3.5" /> Annulla
            </button>
            <Button size="sm" onClick={salva} disabled={busy || !testo.trim()}>
              {busy ? 'Salvo…' : 'Salva nota'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
