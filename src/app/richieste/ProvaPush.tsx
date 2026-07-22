'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';

// Tester push: si sceglie un socio tra quelli con le notifiche attive e gli
// si manda una notifica di prova. Utile con il socio davanti per capire se
// il suo telefono le riceve. Mostra la risposta grezza del portale.

type Socio = { member_id: string; nome: string; dispositivi: number };

export default function ProvaPush() {
  const [soci, setSoci] = useState<Socio[]>([]);
  const [scelto, setScelto] = useState('');
  const [busy, setBusy] = useState(false);
  const [esito, setEsito] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/push-prova')
      .then((r) => r.json())
      .then((j) => setSoci(j.soci || []))
      .catch(() => setSoci([]));
  }, []);

  async function prova() {
    setBusy(true);
    setEsito(null);
    try {
      const r = await fetch('/api/push-prova', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scelto ? { member_id: scelto } : {}),
      });
      const j = await r.json();
      if (j.messaggio) setEsito(j.messaggio);
      else if (j.risposta_portale)
        setEsito(
          `${j.avviso_creato ? 'Avviso di prova creato. ' : ''}Portale (HTTP ${j.stato_http}): ${j.risposta_portale}`
        );
      else setEsito(JSON.stringify(j));
    } catch {
      setEsito('Non riesco a contattare il gestionale.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={scelto}
          onChange={(e) => setScelto(e.target.value)}
          className="text-xs px-2 py-1.5 rounded-md border border-border bg-bg-surface text-text max-w-full"
        >
          <option value="">Solo spingi la coda (nessun socio)</option>
          {soci.map((s) => (
            <option key={s.member_id} value={s.member_id}>
              {s.nome} · {s.dispositivi}{' '}
              {s.dispositivi === 1 ? 'dispositivo' : 'dispositivi'}
            </option>
          ))}
        </select>
        <button
          onClick={prova}
          disabled={busy}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border text-text-muted hover:text-text disabled:opacity-50"
        >
          <Bell className="h-3.5 w-3.5" />
          {busy
            ? 'Invio…'
            : scelto
              ? 'Invia notifica di prova'
              : 'Prova le notifiche push'}
        </button>
      </div>
      {soci.length === 0 && (
        <p className="mt-1 text-[11px] text-text-dim">
          Nessun socio con le notifiche attive (o elenco non caricato).
        </p>
      )}
      {esito && (
        <p className="mt-2 text-xs text-text-muted bg-bg-surface border border-border rounded-md px-3 py-2 font-mono break-all">
          {esito}
        </p>
      )}
    </div>
  );
}
