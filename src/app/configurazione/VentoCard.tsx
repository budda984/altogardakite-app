'use client';

import { useState } from 'react';
import { Wind, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// Taratura degli avvisi vento: chiede al portale cosa vedono le previsioni
// nei prossimi giorni, senza mandare niente ai soci. Il numero da
// confrontare con Windguru e' la raffica del pomeriggio.

type Riga = {
  giorno: string;
  gradiente_mattina: number | null;
  raffica_pomeriggio: number | null;
};
type Trovato = { tipo: string; giorno: string; valore: number };
type Esito = {
  ok?: boolean;
  messaggio?: string;
  error?: string;
  quadro?: Riga[];
  supererebbero?: Trovato[];
  soglie?: { peler: number; ora: number; giorni: number };
  modelli?: { raffiche: string; pressione: string };
};

function giornoIt(g: string) {
  return new Date(`${g}T12:00:00`).toLocaleDateString('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export default function VentoCard() {
  const [busy, setBusy] = useState(false);
  const [esito, setEsito] = useState<Esito | null>(null);

  async function guarda() {
    setBusy(true);
    setEsito(null);
    try {
      const r = await fetch('/api/vento-prova', { method: 'POST' });
      setEsito(await r.json());
    } catch {
      setEsito({ messaggio: 'Non riesco a contattare il gestionale.' });
    } finally {
      setBusy(false);
    }
  }

  const quadro = esito?.quadro ?? [];
  const scatta = new Set(
    (esito?.supererebbero ?? []).map((t) => `${t.tipo}|${t.giorno}`)
  );

  return (
    <div className="bg-bg-surface border border-border rounded-lg p-5 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight flex items-center gap-2">
            <Wind className="h-5 w-5 text-accent" />
            Avvisi vento — taratura
          </h2>
          <p className="text-xs text-text-muted mt-1">
            Cosa vedono le previsioni nei prossimi giorni. Non manda nulla ai
            soci: serve a confrontare i numeri con Windguru e regolare le soglie.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={guarda} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guarda'}
        </Button>
      </div>

      {esito?.soglie && (
        <p className="text-xs text-text-muted mb-3">
          Soglie attuali: peler sotto{' '}
          <strong className="text-text">{esito.soglie.peler} hPa</strong>, ora
          sopra <strong className="text-text">{esito.soglie.ora} nodi</strong>,
          fino a {esito.soglie.giorni} giorni avanti.
          {esito.modelli && (
            <>
              {' '}Modelli: raffiche{' '}
              <strong className="text-text">{esito.modelli.raffiche}</strong>,
              pressione{' '}
              <strong className="text-text">{esito.modelli.pressione}</strong>.
            </>
          )}
        </p>
      )}

      {quadro.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-dim uppercase tracking-wider">
                <th className="py-2 pr-3 font-medium">Giorno</th>
                <th className="py-2 pr-3 font-medium">Gradiente mattina</th>
                <th className="py-2 pr-3 font-medium">Raffica pomeriggio</th>
                <th className="py-2 font-medium">Avviso</th>
              </tr>
            </thead>
            <tbody>
              {quadro.map((r) => {
                const peler = scatta.has(`peler|${r.giorno}`);
                const ora = scatta.has(`ora|${r.giorno}`);
                return (
                  <tr key={r.giorno} className="border-t border-border">
                    <td className="py-2 pr-3 text-text">{giornoIt(r.giorno)}</td>
                    <td className="py-2 pr-3 font-mono text-text-muted">
                      {r.gradiente_mattina ?? '—'}
                    </td>
                    <td className="py-2 pr-3 font-mono text-text-muted">
                      {r.raffica_pomeriggio ?? '—'}
                    </td>
                    <td className="py-2 text-xs">
                      {peler || ora ? (
                        <span className="text-accent font-medium">
                          {[peler && 'peler', ora && 'ora']
                            .filter(Boolean)
                            .join(' + ')}
                        </span>
                      ) : (
                        <span className="text-text-dim">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(esito?.messaggio || esito?.error) && (
        <p className="mt-3 text-xs text-text-muted bg-bg-elevated border border-border rounded-md px-3 py-2 break-all">
          {esito.messaggio || esito.error}
        </p>
      )}
    </div>
  );
}
