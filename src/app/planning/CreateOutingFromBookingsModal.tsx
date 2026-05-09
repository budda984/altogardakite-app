'use client';

import { useState, useEffect } from 'react';
import { Loader2, Sailboat, Users } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';
import type {
  Boat, Instructor, SessionTemplate, BookingWithMember, LiftDiscipline,
} from '@/lib/types';
import { DISCIPLINE_LABELS } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  date: string;
  template: SessionTemplate;
  bookings: BookingWithMember[];
  boats: Boat[];
  instructors: Instructor[];
  onSuccess: () => void;
}

export default function CreateOutingFromBookingsModal({
  open, onClose, date, template, bookings, boats, instructors, onSuccess,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [boatId, setBoatId] = useState('');
  const [instructorIds, setInstructorIds] = useState<string[]>([]);
  const [discipline, setDiscipline] = useState<LiftDiscipline>(template.discipline);
  const [departureTime, setDepartureTime] = useState(template.default_departure_time?.slice(0, 5) || '');
  const [returnTime, setReturnTime] = useState(template.default_return_time?.slice(0, 5) || '');
  const [weatherNotes, setWeatherNotes] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedBookingIds, setSelectedBookingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setBoatId('');
      setInstructorIds([]);
      setDiscipline(template.discipline);
      setDepartureTime(template.default_departure_time?.slice(0, 5) || '');
      setReturnTime(template.default_return_time?.slice(0, 5) || '');
      setWeatherNotes('');
      setNotes('');
      // Default: tutti i bookings selezionati
      setSelectedBookingIds(new Set(bookings.map((b) => b.id)));
      setError(null);
    }
  }, [open, template, bookings]);

  const toggleBooking = (id: string) => {
    setSelectedBookingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleInstructor = (id: string) => {
    setInstructorIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectedBoat = boats.find((b) => b.id === boatId);
  const exceedsCapacity =
    selectedBoat?.capacity != null &&
    selectedBookingIds.size > selectedBoat.capacity;

  const handleSubmit = async () => {
    if (!boatId) {
      setError('Seleziona una barca');
      return;
    }
    if (selectedBookingIds.size === 0) {
      setError('Seleziona almeno una prenotazione');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/bookings/crea-uscita', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_ids: Array.from(selectedBookingIds),
          outing_date: date,
          session_template_id: template.id,
          boat_id: boatId,
          discipline,
          departure_time: departureTime,
          return_time: returnTime,
          wind_session: template.wind_session,
          weather_notes: weatherNotes,
          notes,
          instructor_ids: instructorIds,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Errore');

      alert(`Uscita creata con ${result.participants_count} partecipanti.`);
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
      title={`Crea uscita per ${template.name}`}
      description={`Le prenotazioni selezionate diventeranno partecipanti dell'uscita`}
      size="xl"
    >
      <div className="space-y-5">
        {/* Configurazione uscita */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Imbarcazione *"
            value={boatId}
            onChange={(e) => setBoatId(e.target.value)}
          >
            <option value="">— Seleziona —</option>
            {boats.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}{b.capacity ? ` (cap. ${b.capacity})` : ''}
              </option>
            ))}
          </Select>
          <Select
            label="Disciplina"
            value={discipline}
            onChange={(e) => setDiscipline(e.target.value as LiftDiscipline)}
          >
            {Object.entries(DISCIPLINE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          <Input
            label="Partenza"
            type="time"
            value={departureTime}
            onChange={(e) => setDepartureTime(e.target.value)}
          />
          <Input
            label="Rientro"
            type="time"
            value={returnTime}
            onChange={(e) => setReturnTime(e.target.value)}
          />
        </div>

        {/* Istruttori */}
        <div>
          <label className="block text-sm font-medium text-text mb-2">Istruttori a bordo</label>
          <div className="p-3 rounded bg-bg-elevated border border-border max-h-40 overflow-y-auto space-y-1.5">
            {instructors.length === 0 ? (
              <p className="text-xs text-text-muted">Nessun istruttore attivo</p>
            ) : (
              instructors.map((i) => (
                <label key={i.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={instructorIds.includes(i.id)}
                    onChange={() => toggleInstructor(i.id)}
                    className="rounded"
                  />
                  <span>
                    {i.first_name} {i.last_name}
                    <span className="text-text-dim text-xs ml-1">({i.role})</span>
                  </span>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Selezione prenotazioni */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-text">
              Partecipanti ({selectedBookingIds.size}/{bookings.length})
            </label>
            <button
              type="button"
              onClick={() => {
                if (selectedBookingIds.size === bookings.length) {
                  setSelectedBookingIds(new Set());
                } else {
                  setSelectedBookingIds(new Set(bookings.map((b) => b.id)));
                }
              }}
              className="text-xs text-accent hover:underline"
            >
              {selectedBookingIds.size === bookings.length ? 'Deseleziona tutti' : 'Seleziona tutti'}
            </button>
          </div>
          <div className={cn(
            'p-3 rounded border max-h-64 overflow-y-auto space-y-1.5',
            exceedsCapacity ? 'bg-red-500/5 border-red-500/30' : 'bg-bg-elevated border-border'
          )}>
            {bookings.map((b) => {
              const checked = selectedBookingIds.has(b.id);
              return (
                <label
                  key={b.id}
                  className={cn(
                    'flex items-center gap-2 p-1.5 rounded cursor-pointer',
                    checked ? 'bg-accent/5' : ''
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleBooking(b.id)}
                    className="rounded"
                  />
                  <span className="text-sm flex-1">
                    {b.last_name} {b.first_name}
                    <span className="text-xs text-text-dim ml-1.5">#{b.membership_number}</span>
                    {b.preferred_discipline && (
                      <span className="text-[10px] text-text-muted ml-1.5">
                        ({DISCIPLINE_LABELS[b.preferred_discipline]})
                      </span>
                    )}
                  </span>
                  {b.notes && (
                    <span className="text-[10px] text-text-dim italic truncate max-w-[200px]">
                      {b.notes}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
          {exceedsCapacity && selectedBoat && (
            <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
              Capienza barca superata: {selectedBookingIds.size} su {selectedBoat.capacity} posti.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4">
          <Input
            label="Note meteo"
            value={weatherNotes}
            onChange={(e) => setWeatherNotes(e.target.value)}
            placeholder="es. raffiche 18-22 nodi"
          />
          <Textarea
            label="Note generali"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
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
            disabled={submitting || selectedBookingIds.size === 0 || !boatId}
          >
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sailboat className="h-4 w-4 mr-2" />}
            Crea uscita con {selectedBookingIds.size} {selectedBookingIds.size === 1 ? 'partecipante' : 'partecipanti'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
