'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Checkbox } from '@/components/ui/Checkbox';
import {
  planningOutingSchema, type PlanningOutingFormData,
} from '@/lib/validation/admin-schemas';
import type {
  Boat, Instructor, SessionTemplate, LiftDiscipline, WindSession,
} from '@/lib/types';
import { DISCIPLINE_LABELS, WIND_SESSION_LABELS } from '@/lib/types';
import { useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  date: string;
  template: SessionTemplate | null;
  boats: Boat[];
  instructors: Instructor[];
  existingBoats: string[];
  onSuccess: () => void;
}

export default function AddOutingModal({
  open, onClose, date, template, boats, instructors, existingBoats, onSuccess,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register, handleSubmit, reset, control, formState: { errors },
  } = useForm<PlanningOutingFormData>({
    resolver: zodResolver(planningOutingSchema),
    defaultValues: {
      outing_date: date,
      session_template_id: null,
      discipline: 'kite',
      wind_session: null,
      instructor_ids: [],
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        outing_date: date,
        session_template_id: template?.id || null,
        boat_id: undefined,
        departure_time: template?.default_departure_time?.slice(0, 5) || '',
        return_time: template?.default_return_time?.slice(0, 5) || '',
        discipline: (template?.discipline as LiftDiscipline) || 'kite',
        wind_session: (template?.wind_session as WindSession) || null,
        weather_notes: '',
        notes: '',
        instructor_ids: [],
      });
      setError(null);
    }
  }, [open, template, date, reset]);

  const availableBoats = boats.filter((b) => !existingBoats.includes(b.id));

  const onSubmit = async (data: PlanningOutingFormData) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/planning/uscita', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Errore salvataggio');
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
      title={template ? `Aggiungi barca a "${template.name}"` : 'Nuova uscita extra'}
      description={template
        ? `${DISCIPLINE_LABELS[template.discipline]} · orario standard ${template.default_departure_time.slice(0, 5)}–${template.default_return_time.slice(0, 5)}`
        : 'Sessione non collegata a template'
      }
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {availableBoats.length === 0 ? (
          <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 text-sm text-amber-400">
            Tutte le imbarcazioni sono gia state assegnate a questa sessione.
          </div>
        ) : (
          <Select label="Imbarcazione *" {...register('boat_id')} error={errors.boat_id?.message}>
            <option value="">— Seleziona barca —</option>
            {availableBoats.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} {b.capacity ? `(cap. ${b.capacity})` : ''}
              </option>
            ))}
          </Select>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Partenza"
            type="time"
            {...register('departure_time')}
          />
          <Input
            label="Rientro"
            type="time"
            {...register('return_time')}
          />
        </div>

        {!template && (
          <div className="grid grid-cols-2 gap-4">
            <Select label="Disciplina" {...register('discipline')}>
              {(Object.keys(DISCIPLINE_LABELS) as LiftDiscipline[]).map((d) => (
                <option key={d} value={d}>{DISCIPLINE_LABELS[d]}</option>
              ))}
            </Select>
            <Select label="Sessione vento" {...register('wind_session')}>
              <option value="">— Nessuna —</option>
              {(Object.keys(WIND_SESSION_LABELS) as WindSession[]).map((w) => (
                <option key={w} value={w}>{WIND_SESSION_LABELS[w]}</option>
              ))}
            </Select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-text mb-2">Istruttori a bordo</label>
          <Controller
            control={control}
            name="instructor_ids"
            render={({ field }) => (
              <div className="space-y-1.5 p-3 rounded bg-bg-elevated border border-border max-h-48 overflow-y-auto">
                {instructors.length === 0 ? (
                  <p className="text-xs text-text-muted">Nessun istruttore attivo</p>
                ) : (
                  instructors.map((i) => {
                    const checked = field.value.includes(i.id);
                    return (
                      <label key={i.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              field.onChange([...field.value, i.id]);
                            } else {
                              field.onChange(field.value.filter((id: string) => id !== i.id));
                            }
                          }}
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
            )}
          />
        </div>

        <Input
          label="Note meteo"
          placeholder="es. raffiche 18-22 nodi, mare mosso"
          {...register('weather_notes')}
        />

        <Textarea label="Note" {...register('notes')} />

        {error && (
          <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annulla</Button>
          <Button type="submit" disabled={submitting || availableBoats.length === 0}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Crea uscita
          </Button>
        </div>
      </form>
    </Modal>
  );
}
