'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { cn } from '@/lib/utils';
import type { RichiestaDaRispondere } from '@/lib/types';

const MOTIVI_PRONTI = [
  'Siamo al completo.',
  'Il vento previsto non è adatto al tuo livello.',
  'Il certificato medico è da rinnovare.',
  'Non abbiamo istruttori disponibili.',
];

const DISCIPLINE: Record<string, string> = {
  kite: 'Kitesurf',
  wingfoil: 'Wing foil',
  sit_kite: 'Sit & Kite',
  wingfoil_adattato: 'Wing foil adattato',
  corso: 'Corso',
  altro: 'Altro',
};

function giornoIso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function etichettaGiornata(iso: string) {
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  const domani = new Date(oggi);
  domani.setDate(domani.getDate() + 1);

  const lungo = new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  if (iso < giornoIso(oggi)) return { testo: `In ritardo · ${lungo}`, livello: 'urgente' as const };
  if (iso === giornoIso(oggi)) return { testo: `Oggi · ${lungo}`, livello: 'urgente' as const };
  if (iso === giornoIso(domani)) return { testo: `Domani · ${lungo}`, livello: 'urgente' as const };

  const dopodomani = new Date(oggi);
  dopodomani.setDate(dopodomani.getDate() + 2);
  if (iso === giornoIso(dopodomani)) return { testo: lungo, livello: 'presto' as const };

  return { testo: lungo, livello: 'calmo' as const };
}

function daQuando(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return `arrivata ${min} min fa`;
  const ore = Math.round(min / 60);
  if (ore < 24) return `arrivata ${ore} ${ore === 1 ? 'ora' : 'ore'} fa`;
  const gg = Math.round(ore / 24);
  return `arrivata ${gg} ${gg === 1 ? 'giorno' : 'giorni'} fa`;
}

export default function RichiesteList({ richieste }: { richieste: RichiestaDaRispondere[] }) {
  const router = useRouter();
  const [inCorso, startTransition] = useTransition();
  const [lavorando, setLavorando] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [rifiuto, setRifiuto] = useState<RichiestaDaRispondere | null>(null);
  const [motivo, setMotivo] = useState('');

  async function rispondi(id: string, accetta: boolean, testoMotivo?: string) {
    setLavorando(id);
    setErrore(null);
    try {
      const res = await fetch(`/api/richieste/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accetta, motivo: testoMotivo }),
      });
      const j = await res.json();
      if (!res.ok) {
        setErrore(j.error || 'Non ha funzionato');
        return;
      }
      setRifiuto(null);
      setMotivo('');
      startTransition(() => router.refresh());
    } catch {
      setErrore('Non riesco a raggiungere il server');
    } finally {
      setLavorando(null);
    }
  }

  if (richieste.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-lg p-12 text-center">
        <p className="text-sm text-text-muted">
          Nessuna richiesta da rispondere.
          <br />
          Quando un socio prenota dal portale, la trovi qui.
        </p>
      </div>
    );
  }

  // Raggruppate per giornata, gia' ordinate dalla vista.
  const perGiorno = richieste.reduce<Record<string, RichiestaDaRispondere[]>>((acc, r) => {
    (acc[r.booking_date] ||= []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {errore && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
          {errore}
        </div>
      )}

      {Object.entries(perGiorno).map(([giorno, gruppo]) => {
        const et = etichettaGiornata(giorno);
        return (
          <section key={giorno}>
            <div className="flex items-center gap-3 mb-3">
              <h2
                className={cn(
                  'font-display text-xs font-bold tracking-widest uppercase',
                  et.livello === 'urgente' && 'text-red-400',
                  et.livello === 'presto' && 'text-amber-400',
                  et.livello === 'calmo' && 'text-text-muted'
                )}
              >
                {et.testo}
              </h2>
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-text-muted">{gruppo.length}</span>
            </div>

            <div className="space-y-2">
              {gruppo.map((r) => (
                <Scheda
                  key={r.id}
                  r={r}
                  livello={et.livello}
                  occupato={lavorando === r.id || inCorso}
                  onAccetta={() => rispondi(r.id, true)}
                  onRifiuta={() => {
                    setRifiuto(r);
                    setMotivo(MOTIVI_PRONTI[0]);
                  }}
                />
              ))}
            </div>
          </section>
        );
      })}

      <Modal
        open={rifiuto !== null}
        onClose={() => setRifiuto(null)}
        title="Perché no?"
      >
        {rifiuto && (
          <div className="space-y-4">
            <p className="text-sm text-text-muted">
              Questo testo finisce nel portale di {rifiuto.first_name}. Scrivi quello che gli
              diresti a voce.
            </p>

            <div className="space-y-2">
              {MOTIVI_PRONTI.map((m) => (
                <button
                  key={m}
                  onClick={() => setMotivo(m)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-md border text-sm transition-colors',
                    motivo === m
                      ? 'border-accent bg-accent/5'
                      : 'border-border bg-bg-surface hover:border-border-strong'
                  )}
                >
                  {m}
                </button>
              ))}
            </div>

            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              placeholder="oppure scrivi tu…"
              className="w-full bg-bg-input border border-border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:border-accent"
            />

            <div className="bg-red-500/10 rounded-md p-3">
              <p className="text-[10px] font-medium tracking-widest uppercase text-red-400 mb-1">
                {rifiuto.first_name} leggerà
              </p>
              <p className="text-xs leading-relaxed">
                Per il{' '}
                {new Date(rifiuto.booking_date + 'T00:00:00').toLocaleDateString('it-IT')} (
                {rifiuto.fascia}) non riusciamo a tenerti il posto.
                {motivo.trim() ? ` ${motivo.trim()}` : ''} Se vuoi provare un altro giorno
                scrivici su WhatsApp.
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setRifiuto(null)}
                className="flex-1 px-4 py-2.5 rounded-md border border-border text-sm text-text-muted hover:text-text"
              >
                Torna indietro
              </button>
              <button
                onClick={() => rispondi(rifiuto.id, false, motivo)}
                disabled={lavorando === rifiuto.id}
                className="flex-1 px-4 py-2.5 rounded-md bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50"
              >
                {lavorando === rifiuto.id ? 'Un attimo…' : 'Rifiuta e avvisa'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Scheda({
  r,
  livello,
  occupato,
  onAccetta,
  onRifiuta,
}: {
  r: RichiestaDaRispondere;
  livello: 'urgente' | 'presto' | 'calmo';
  occupato: boolean;
  onAccetta: () => void;
  onRifiuta: () => void;
}) {
  const disciplina = DISCIPLINE[r.preferred_discipline ?? ''] ?? r.template_name;

  return (
    <div
      className={cn(
        'bg-bg-surface border border-border rounded-lg p-4 border-l-[3px]',
        livello === 'urgente' && 'border-l-red-400',
        livello === 'presto' && 'border-l-amber-400',
        livello === 'calmo' && 'border-l-border-strong'
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-lg font-bold tracking-tight">
          {r.first_name} {r.last_name}
        </span>
        {r.membership_number != null && (
          <span className="text-xs text-text-muted shrink-0">#{r.membership_number}</span>
        )}
      </div>

      <p className="text-xs text-text-muted mt-1">
        <span className="text-text font-medium">{disciplina}</span> · {r.fascia} ·{' '}
        {r.default_departure_time?.slice(0, 5)}
      </p>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {r.tessera_scaduta && (
          <Pill tono="male">
            <AlertTriangle className="h-3 w-3" />
            Tessera scaduta
          </Pill>
        )}
        {r.certificato_non_valido && (
          <Pill tono="male">
            <AlertTriangle className="h-3 w-3" />
            Certificato non valido
          </Pill>
        )}
        {r.is_waitlist && <Pill tono="giallo">In lista d&apos;attesa</Pill>}
        {r.ha_abbonamento ? (
          <Pill tono="bene">Abbonamento</Pill>
        ) : r.lift_residui != null ? (
          <Pill tono={r.lift_residui > 0 ? 'neutro' : 'giallo'}>
            {r.lift_residui} lift {r.lift_residui === 1 ? 'residuo' : 'residui'}
          </Pill>
        ) : (
          <Pill tono="giallo">Nessun pacchetto</Pill>
        )}
        <Pill tono="neutro">
          {r.posti_liberi} posti su {r.capienza}
        </Pill>
        {r.altre_richieste_sulla_fascia > 1 && (
          <Pill tono="neutro">{r.altre_richieste_sulla_fascia} richieste sulla fascia</Pill>
        )}
      </div>

      {r.notes && (
        <p className="mt-3 bg-bg-input rounded-md px-3 py-2 text-xs text-text-muted italic leading-relaxed">
          «{r.notes}»
        </p>
      )}

      <div className="flex gap-2 mt-3">
        <button
          onClick={onAccetta}
          disabled={occupato}
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-md bg-accent text-bg text-sm font-semibold hover:bg-accent-hover disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          Accetta
        </button>
        <button
          onClick={onRifiuta}
          disabled={occupato}
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-md border border-border text-sm text-text-muted hover:text-text disabled:opacity-50"
        >
          <X className="h-4 w-4" />
          Rifiuta
        </button>
      </div>

      <p className="text-[10px] text-text-muted text-right mt-2">{daQuando(r.created_at)}</p>
    </div>
  );
}

function Pill({
  children,
  tono,
}: {
  children: React.ReactNode;
  tono: 'neutro' | 'male' | 'bene' | 'giallo';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded',
        tono === 'neutro' && 'bg-bg-elevated text-text-muted',
        tono === 'male' && 'bg-red-500/10 text-red-400',
        tono === 'bene' && 'bg-accent/10 text-accent',
        tono === 'giallo' && 'bg-amber-500/10 text-amber-400'
      )}
    >
      {children}
    </span>
  );
}
