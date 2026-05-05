'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import type { Boat, Instructor } from '@/lib/types';

interface OutingForEdit {
  id: string;
  status: string;
  boat_id: string;
  departure_time: string | null;
  return_time: string | null;
  weather_notes: string | null;
  notes: string | null;
  outing_instructors: { instructor_id: string }[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  outing: OutingForEdit;
  boats: Boat[];
  instructors: Instructor[];
  onSuccess: () => void;
}

export default function EditOutingModal({
  open, onClose, outing, boats, instructors, onSuccess,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // form state
  const [boatId, setBoatId] = useState(outing.boat_id);
  const [departureTime, setDepartureTime] = useState(outing.departure_time?.slice(0, 5) || '');
  const [returnTime, setReturnTime] = useState(outing.return_time?.slice(0, 5) || '');
  const [weatherNotes, setWeatherNotes] = useState(outing.weather_notes || '');
  const [notes, setNotes] = useState(outing.notes || '');
  const [instructorIds, setInstructorIds] = useState<string[]>(
    outing.outing_instructors.map((oi) => oi.instructor_id)
  );

  const isClosed = outing.status === 'chiusa';

  useEffect(() => {
    if (open) {
      setBoatId(outing.boat_id);
      setDepartureTime(outing.departure_time?.slice(0, 5) || '');
      setReturnTime(outing.return_time?.slice(0, 5) || '');
      setWeatherNotes(outing.weather_notes || '');
      setNotes(outing.notes || '');
      setInstructorIds(outing.outing_instructors.map((oi) => oi.instructor_id));
      setError(null);
    }
  }, [open, outing]);

  const toggleInstructor = (id: string) => {
    setInstructorIds((cur) =>
      cur.includes(id) ? cur.filter((i) => i !== id) : [...cur, id]
    );
  };

  const handleSave = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        departure_time: departureTime,
        return_time: returnTime,
        weather_notes: weatherNotes,
        notes,
        instructor_ids: instructorIds,
      };
      // Solo se non chiusa, permetto cambio barca
      if (!isClosed) {
        payload.boat_id = boatId;
      }
      const res = await fetch(`/api/planning/uscita/${outing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
    <Modal open={open} onClose={onClose} title="Modifica uscita" size="lg">
      <div className="space-y-5">
        {isClosed && (
          <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
            Uscita chiusa: puoi modificare orari, istruttori e note. Per cambiare imbarcazione devi prima riaprire l&apos;uscita.
          </div>
        )}

        <Select
          label="Imbarcazione *"
          value={boatId}
          onChange={(e) => setBoatId(e.target.value)}
          disabled={isClosed}
        >
          {boats.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} {b.capacity ? `(cap. ${b.capacity})` : ''}
            </option>
          ))}
        </Select>

        <div className="grid grid-cols-2 gap-4">
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

        <div>
          <label className="block text-sm font-medium text-text mb-2">Istruttori a bordo</label>
          <div className="space-y-1.5 p-3 rounded bg-bg-elevated border border-border max-h-48 overflow-y-auto">
            {instructors.length === 0 ? (
              <p className="text-xs text-text-muted">Nessun istruttore attivo</p>
            ) : (
              instructors.map((i) => {
                const checked = instructorIds.includes(i.id);
                return (
                  <label key={i.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleInstructor(i.id)}
                      className="rounded"
                    />
                    <span>
                      {i.first_name} {i.last_name}
                      <span className="text-text-dim text-xs ml-1">({i.role})</span>
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        <Input
          label="Note meteo"
          value={weatherNotes}
          onChange={(e) => setWeatherNotes(e.target.value)}
          placeholder="es. raffiche 18-22 nodi"
        />

        <Textarea
          label="Note"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {error && (
          <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-border">
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salva
          </Button>
        </div>
      </div>
    </Modal>
  );
}
