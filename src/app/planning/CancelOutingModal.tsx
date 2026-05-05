'use client';

import { useState, useEffect } from 'react';
import { Loader2, XCircle, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';

interface Props {
  open: boolean;
  onClose: () => void;
  outingId: string;
  boatName: string;
  wasClosedBefore: boolean;
  participantCount: number;
  onSuccess: () => void;
}

const QUICK_REASONS = [
  'Mancanza di vento',
  'Vento eccessivo',
  'Pioggia',
  'Mare mosso',
  'Visibilita scarsa',
  'Problema tecnico imbarcazione',
  'Mancanza istruttori',
];

export default function CancelOutingModal({
  open, onClose, outingId, boatName, wasClosedBefore, participantCount, onSuccess,
}: Props) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('Motivazione obbligatoria');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/planning/uscita/${outingId}/annulla`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Errore');
      const refundMsg = result.was_closed
        ? `\n\nRimborsi automatici: ${result.movements_reversed} movimenti stornati, ${result.lifts_restored} lift ripristinati.`
        : '';
      alert(`Uscita annullata.${refundMsg}`);
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
      title={`Annulla uscita su ${boatName}`}
      description={
        wasClosedBefore
          ? 'L\'uscita era gia chiusa: gli addebiti saranno rimborsati automaticamente'
          : 'L\'uscita verra marcata come annullata'
      }
      size="lg"
    >
      <div className="space-y-5">
        {wasClosedBefore && participantCount > 0 && (
          <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
            <div className="flex gap-2 items-start">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                Per i {participantCount} partecipanti registrati: tutti gli addebiti saranno stornati,
                i lift consumati ripristinati nei pacchetti, le coperture da abbonamento restituite.
                I clienti saranno effettivamente rimborsati.
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-text mb-2">
            Motivazione annullamento *
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {QUICK_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className="text-xs px-2 py-1 rounded bg-bg-elevated border border-border hover:border-accent hover:text-accent text-text-muted"
              >
                {r}
              </button>
            ))}
          </div>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Specifica perche la sessione e stata annullata"
            rows={3}
          />
        </div>

        {error && (
          <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-border">
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !reason.trim()}
            className="bg-red-500 hover:bg-red-600"
          >
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
            Annulla uscita
          </Button>
        </div>
      </div>
    </Modal>
  );
}
