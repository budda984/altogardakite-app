'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';

// Bottone di diagnosi: forza l'invio delle push in coda e mostra cosa
// risponde il portale. Serve a provare la catena senza terminale.
export default function ProvaPush() {
  const [busy, setBusy] = useState(false);
  const [esito, setEsito] = useState<string | null>(null);

  async function prova() {
    setBusy(true);
    setEsito(null);
    try {
      const r = await fetch('/api/push-prova', { method: 'POST' });
      const j = await r.json();
      if (j.risposta_portale) {
        setEsito(`Portale (HTTP ${j.stato_http}): ${j.risposta_portale}`);
      } else {
        setEsito(j.messaggio || JSON.stringify(j));
      }
    } catch {
      setEsito('Non riesco a contattare il gestionale.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6">
      <button
        onClick={prova}
        disabled={busy}
        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border text-text-muted hover:text-text disabled:opacity-50"
      >
        <Bell className="h-3.5 w-3.5" />
        {busy ? 'Invio…' : 'Prova le notifiche push'}
      </button>
      {esito && (
        <p className="mt-2 text-xs text-text-muted bg-bg-surface border border-border rounded-md px-3 py-2 font-mono break-all">
          {esito}
        </p>
      )}
    </div>
  );
}
