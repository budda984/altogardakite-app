'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';

// Tasto accanto a WhatsApp nella scheda socio: apre un campo, scrivi il
// messaggio e lo mandi al portale del socio. Se ha le push attive gli suona
// il telefono, altrimenti lo trovera' aprendo il portale.
export default function NotificaSocio({ memberId }: { memberId: string }) {
  const [aperto, setAperto] = useState(false);
  const [testo, setTesto] = useState('');
  const [busy, setBusy] = useState(false);
  const [esito, setEsito] = useState<string | null>(null);

  async function invia() {
    if (!testo.trim()) return;
    setBusy(true);
    setEsito(null);
    try {
      const r = await fetch('/api/notifica-socio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId, testo: testo.trim() }),
      });
      const j = await r.json();
      if (!r.ok || j.error) {
        setEsito(j.error || j.messaggio || 'Non inviato.');
      } else {
        setEsito(
          j.ha_push
            ? 'Inviato: gli arriva sul telefono.'
            : 'Inviato: lo vedra\u2019 aprendo il portale (niente push attiva).'
        );
        setTesto('');
      }
    } catch {
      setEsito('Non riesco a contattare il gestionale.');
    } finally {
      setBusy(false);
    }
  }

  if (!aperto) {
    return (
      <button
        onClick={() => setAperto(true)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 text-accent border border-accent/25 hover:bg-accent/20 transition-colors"
      >
        <Bell className="h-4 w-4" /> Notifica portale
      </button>
    );
  }

  return (
    <div className="w-full mt-2 p-3 rounded-lg border border-border bg-bg-surface">
      <textarea
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
        placeholder="Messaggio per il socio…"
        maxLength={500}
        rows={3}
        className="w-full text-sm px-3 py-2 rounded-md border border-border bg-bg-elevated text-text resize-none focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <div className="flex items-center justify-between gap-2 mt-2">
        <span className="text-xs text-text-dim">{testo.length}/500</span>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setAperto(false);
              setEsito(null);
              setTesto('');
            }}
            className="text-xs px-3 py-1.5 rounded-md text-text-muted hover:text-text"
          >
            Annulla
          </button>
          <button
            onClick={invia}
            disabled={busy || !testo.trim()}
            className="text-xs px-3 py-1.5 rounded-md bg-accent text-white disabled:opacity-50"
          >
            {busy ? 'Invio…' : 'Invia'}
          </button>
        </div>
      </div>
      {esito && <p className="mt-2 text-xs text-text-muted">{esito}</p>}
    </div>
  );
}
