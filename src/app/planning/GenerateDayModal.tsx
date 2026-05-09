'use client';

import { useEffect, useState } from 'react';
import { Loader2, Sparkles, AlertCircle, Check } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import type { Boat, SessionTemplate, LiftDiscipline, WindSession } from '@/lib/types';
import { DISCIPLINE_LABELS, WIND_SESSION_LABELS } from '@/lib/types';

interface ExistingOuting {
  boat_id: string;
  session_template_id: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  date: string;
  boats: Boat[];
  templates: SessionTemplate[];
  existingOutings: ExistingOuting[];
  onSuccess: () => void;
}

export default function GenerateDayModal({
  open, onClose, date, boats, templates, existingOutings, onSuccess,
}: Props) {
  const [selectedBoat, setSelectedBoat] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedBoat(boats[0]?.id || '');
      setError(null);
    }
  }, [open, boats]);

  // Calcola quali sessioni gia esistono per la barca selezionata
  const willCreate = templates.filter((t) => {
    if (!selectedBoat) return false;
    return !existingOutings.some(
      (o) => o.boat_id === selectedBoat && o.session_template_id === t.id
    );
  });
  const willSkip = templates.filter((t) => {
    if (!selectedBoat) return false;
    return existingOutings.some(
      (o) => o.boat_id === selectedBoat && o.session_template_id === t.id
    );
  });

  const handleGenerate = async () => {
    if (!selectedBoat) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/planning/genera', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, boat_id: selectedBoat }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Errore');
      }
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Genera giorno standard"
      description="Crea automaticamente le sessioni di default su una barca"
      size="lg"
    >
      <div className="space-y-5">
        <Select label="Imbarcazione *" value={selectedBoat} onChange={(e) => setSelectedBoat(e.target.value)}>
          <option value="">— Seleziona —</option>
          {boats.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} {b.capacity ? `(cap. ${b.capacity})` : ''}
            </option>
          ))}
        </Select>

        {selectedBoat && (
          <div>
            <h3 className="text-sm font-medium text-text mb-3">Verranno create:</h3>
            {templates.length === 0 ? (
              <p className="text-sm text-text-muted">Nessun template di default attivo. Configurali da Template sessioni.</p>
            ) : (
              <div className="space-y-2">
                {templates.map((t) => {
                  const skip = willSkip.includes(t);
                  return (
                    <div
                      key={t.id}
                      className={`p-3 rounded border flex items-center gap-3 ${
                        skip
                          ? 'bg-bg-elevated border-border opacity-50'
                          : 'bg-emerald-500/5 border-emerald-500/30'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                        skip ? 'bg-bg-elevated text-text-dim' : 'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {skip ? <AlertCircle className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-text">{t.name}</div>
                        <div className="text-xs text-text-muted">
                          {DISCIPLINE_LABELS[t.discipline]} ·
                          {' '}{t.default_departure_time.slice(0, 5)}–{t.default_return_time.slice(0, 5)}
                          {t.wind_session && ` · ${WIND_SESSION_LABELS[t.wind_session as WindSession]}`}
                        </div>
                      </div>
                      {skip && (
                        <span className="text-[10px] uppercase tracking-widest text-text-dim">Gia esiste</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {willCreate.length > 0 && (
              <div className="mt-4 p-3 rounded bg-accent/10 border border-accent/30 text-sm">
                Saranno create <strong>{willCreate.length}</strong> nuove uscite vuote sulla barca selezionata.
              </div>
            )}

            {willCreate.length === 0 && willSkip.length > 0 && (
              <div className="mt-4 p-3 rounded bg-amber-500/10 border border-amber-500/30 text-sm text-amber-400">
                Tutte le sessioni di default sono gia state create per questa barca.
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annulla</Button>
          <Button onClick={handleGenerate} disabled={!selectedBoat || submitting || willCreate.length === 0}>
            {submitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Genera {willCreate.length > 0 ? `${willCreate.length} sessioni` : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
