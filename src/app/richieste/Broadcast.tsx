'use client';

import { useEffect, useState } from 'react';
import { Megaphone, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// Annuncio a tutti i soci con le notifiche attive. Per la delicatezza (arriva
// a tutti e non si richiama) l'invio passa da una conferma esplicita che dice
// a quanti sta per andare.
export default function Broadcast() {
  const [aperto, setAperto] = useState(false);
  const [titolo, setTitolo] = useState('');
  const [testo, setTesto] = useState('');
  const [quanti, setQuanti] = useState<number | null>(null);
  const [conferma, setConferma] = useState(false);
  const [busy, setBusy] = useState(false);
  const [esito, setEsito] = useState<string | null>(null);

  // Quante persone lo riceverebbero: lo chiedo appena apro il pannello.
  useEffect(() => {
    if (!aperto) return;
    fetch('/api/broadcast')
      .then((r) => r.json())
      .then((j) => setQuanti(typeof j.soci === 'number' ? j.soci : null))
      .catch(() => setQuanti(null));
  }, [aperto]);

  async function invia() {
    setBusy(true);
    setEsito(null);
    try {
      const r = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titolo: titolo.trim(), testo: testo.trim() }),
      });
      const j = await r.json();
      if (!r.ok || j.error) {
        setEsito(j.error || 'Non inviato.');
      } else if (j.inviati === 0) {
        setEsito(j.messaggio || 'Nessun destinatario.');
      } else {
        setEsito(`Inviato a ${j.inviati} ${j.inviati === 1 ? 'socio' : 'soci'}.`);
        setTitolo('');
        setTesto('');
        setConferma(false);
        setAperto(false);
      }
    } catch {
      setEsito('Non riesco a contattare il gestionale.');
    } finally {
      setBusy(false);
    }
  }

  if (!aperto) {
    return (
      <div className="mb-6">
        <button
          onClick={() => setAperto(true)}
          className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border border-border text-text-muted hover:text-text hover:border-accent transition-colors"
        >
          <Megaphone className="h-4 w-4" /> Invia un avviso a tutti
        </button>
        {esito && <p className="mt-2 text-xs text-text-muted">{esito}</p>}
      </div>
    );
  }

  return (
    <div className="mb-6 p-4 rounded-lg border border-border bg-bg-surface">
      <h3 className="text-sm font-semibold flex items-center gap-2 text-text mb-1">
        <Megaphone className="h-4 w-4 text-accent" />
        Avviso a tutti i soci
      </h3>
      <p className="text-xs text-text-muted mb-3">
        Arriva a chi ha le notifiche attive
        {quanti !== null && (
          <> — al momento <strong className="text-text">{quanti}</strong> {quanti === 1 ? 'socio' : 'soci'}</>
        )}
        . Chi non ha l&apos;app lo vedra&apos; aprendo il portale.
      </p>

      <input
        value={titolo}
        onChange={(e) => setTitolo(e.target.value)}
        placeholder="Titolo (facoltativo, es. Chiusura sede)"
        maxLength={80}
        className="w-full text-sm px-3 py-2 mb-2 rounded-md border border-border bg-bg-elevated text-text focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <textarea
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
        placeholder="Il messaggio per tutti i soci…"
        rows={3}
        maxLength={500}
        className="w-full text-sm px-3 py-2 rounded-md border border-border bg-bg-elevated text-text resize-none focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <div className="text-right text-[11px] text-text-dim mt-1">{testo.length}/500</div>

      {!conferma ? (
        <div className="flex justify-end gap-2 mt-2">
          <button
            onClick={() => { setAperto(false); setEsito(null); }}
            className="text-xs px-3 py-1.5 rounded-md text-text-muted hover:text-text"
          >
            Annulla
          </button>
          <Button size="sm" onClick={() => setConferma(true)} disabled={!testo.trim()}>
            Continua
          </Button>
        </div>
      ) : (
        <div className="mt-3 p-3 rounded-md border border-amber-500/30 bg-amber-500/5">
          <p className="text-xs text-amber-500 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Stai per inviare questo avviso
              {quanti !== null ? ` a ${quanti} ${quanti === 1 ? 'socio' : 'soci'}` : ' a tutti i soci con notifiche attive'}.
              Non si puo&apos; annullare dopo l&apos;invio.
            </span>
          </p>
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => setConferma(false)}
              className="text-xs px-3 py-1.5 rounded-md text-text-muted hover:text-text"
            >
              Torna indietro
            </button>
            <Button size="sm" onClick={invia} disabled={busy}>
              {busy ? 'Invio…' : 'Invia ora'}
            </Button>
          </div>
        </div>
      )}

      {esito && <p className="mt-2 text-xs text-text-muted">{esito}</p>}
    </div>
  );
}
