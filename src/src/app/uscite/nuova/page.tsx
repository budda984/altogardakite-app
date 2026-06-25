'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2, Plus, Trash2, X } from 'lucide-react';
import Link from 'next/link';

import { outingSchema, type OutingFormData } from '@/lib/validation/schemas';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { createClient } from '@/lib/supabase/client';
import {
  PARTICIPATION_LABELS,
  RENTAL_LABELS,
  WIND_SESSION_LABELS,
  type Boat,
  type Instructor,
  type Member,
  type Equipment,
  EQUIPMENT_LABELS,
} from '@/lib/types';

export default function NewOutingPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const [boats, setBoats] = useState<Boat[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);

  // Carica dati di riferimento
  useEffect(() => {
    const sb = createClient();
    Promise.all([
      sb.from('boats').select('*').eq('active', true).order('name'),
      sb.from('instructors').select('*').eq('active', true).order('last_name'),
      sb.from('members').select('id, first_name, last_name, membership_number').eq('active', true).order('first_name'),
      sb.from('equipment').select('*').neq('status', 'dismesso').order('code'),
    ]).then(([b, i, m, e]) => {
      setBoats((b.data as Boat[]) || []);
      setInstructors((i.data as Instructor[]) || []);
      setMembers((m.data as Member[]) || []);
      setEquipment((e.data as Equipment[]) || []);
    });
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<OutingFormData>({
    resolver: zodResolver(outingSchema),
    defaultValues: {
      outing_date: today,
      participants: [],
      instructor_ids: [],
    },
  });

  const { fields: participantFields, append, remove } = useFieldArray({
    control,
    name: 'participants',
  });

  const onSubmit = async (data: OutingFormData) => {
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch('/api/uscite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Errore creazione uscita');
      }
      const { id } = await res.json();
      router.push(`/uscite/${id}`);
    } catch (e: any) {
      setServerError(e.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 lg:p-10 max-w-5xl mx-auto">
      <Link href="/uscite" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-accent mb-4">
        <ArrowLeft className="h-4 w-4" /> Tutte le uscite
      </Link>

      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest text-text-dim mb-2">Check list lift</div>
        <h1 className="font-display text-3xl lg:text-4xl font-bold tracking-tightest">
          Nuova uscita
        </h1>
        <p className="mt-2 text-text-muted text-sm">
          Equivalente digitale della checklist cartacea: imbarcazione, istruttori, partecipanti, attrezzature, corsi.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header uscita */}
        <Card title="Dati uscita">
          <div className="grid md:grid-cols-3 gap-4">
            <Input label="Data" type="date" required {...register('outing_date')} error={errors.outing_date?.message} />
            <Input label="Ora partenza" type="time" {...register('departure_time')} />
            <Input label="Ora rientro" type="time" {...register('return_time')} />

            <Select
              label="Imbarcazione"
              required
              placeholder="Seleziona imbarcazione..."
              options={boats.map((b) => ({ value: b.id, label: b.name }))}
              {...register('boat_id')}
              error={errors.boat_id?.message}
            />

            <Select
              label="Sessione di vento"
              placeholder="Seleziona..."
              options={Object.entries(WIND_SESSION_LABELS).map(([v, l]) => ({ value: v, label: l }))}
              {...register('wind_session')}
            />

            <Input label="Note meteo" placeholder="es. raffiche 18-22 nodi" {...register('weather_notes')} />
          </div>

          {/* Istruttori (multi-select via checkboxes) */}
          <div className="mt-6 pt-6 border-t border-border">
            <label className="text-sm font-medium text-text mb-3 block">
              Istruttori / Assistenti <span className="text-accent">*</span>
            </label>
            {instructors.length === 0 ? (
              <p className="text-xs text-text-muted">
                Nessun istruttore registrato. <Link href="/settings" className="text-accent hover:underline">Aggiungi istruttori</Link>
              </p>
            ) : (
              <Controller
                name="instructor_ids"
                control={control}
                render={({ field }) => (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {instructors.map((inst) => {
                      const checked = field.value?.includes(inst.id);
                      return (
                        <label
                          key={inst.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                            checked
                              ? 'border-accent bg-accent/5 text-text'
                              : 'border-border bg-bg-input text-text-muted hover:border-border-strong'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked || false}
                            onChange={(e) => {
                              const v = field.value || [];
                              field.onChange(
                                e.target.checked
                                  ? [...v, inst.id]
                                  : v.filter((x: string) => x !== inst.id)
                              );
                            }}
                            className="accent-accent"
                          />
                          <span className="text-sm">
                            {inst.first_name} {inst.last_name}
                            <span className="text-xs text-text-dim ml-1">({inst.role})</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              />
            )}
            {errors.instructor_ids && (
              <p className="text-xs text-danger mt-2">{errors.instructor_ids.message}</p>
            )}
          </div>
        </Card>

        {/* Partecipanti */}
        <Card
          title={`Partecipanti ${participantFields.length > 0 ? `(${participantFields.length})` : ''}`}
          description="Aggiungi soci, scegli tipo di partecipazione e attrezzatura noleggiata"
        >
          {participantFields.length === 0 && (
            <div className="text-center py-10 border border-dashed border-border rounded-md text-sm text-text-muted">
              Nessun partecipante. Aggiungi il primo qui sotto.
            </div>
          )}

          <div className="space-y-4">
            {participantFields.map((field, idx) => (
              <ParticipantRow
                key={field.id}
                index={idx}
                control={control}
                register={register}
                errors={errors}
                members={members}
                equipment={equipment}
                onRemove={() => remove(idx)}
              />
            ))}
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              append({
                member_id: '',
                participation_type: 'lift_semplice',
                rental_type: 'nessuno',
                rental_price: null,
                course_id: null,
                equipment_ids: [],
                notes: '',
              })
            }
            className="mt-4 w-full"
          >
            <Plus className="h-4 w-4" /> Aggiungi partecipante
          </Button>

          {errors.participants && typeof errors.participants.message === 'string' && (
            <p className="text-xs text-danger mt-2">{errors.participants.message}</p>
          )}
        </Card>

        {/* Note generali */}
        <Card title="Note generali">
          <textarea
            {...register('notes')}
            rows={3}
            placeholder="Note sull'uscita, condizioni particolari, eventi..."
            className="w-full bg-bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </Card>

        {serverError && (
          <div className="bg-danger/10 border border-danger/30 text-danger px-4 py-3 rounded-md text-sm">
            {serverError}
          </div>
        )}

        <div className="flex justify-end gap-3 sticky bottom-0 lg:bottom-auto bg-bg/95 backdrop-blur p-4 -mx-4 lg:mx-0 lg:p-0 lg:bg-transparent border-t border-border lg:border-0">
          <Link href="/uscite">
            <Button type="button" variant="ghost">Annulla</Button>
          </Link>
          <Button type="submit" disabled={submitting} size="lg">
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Salvataggio...</>
            ) : (
              'Salva uscita'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// PARTICIPANT ROW
// ============================================================================
function ParticipantRow({
  index, control, register, errors, members, equipment, onRemove
}: any) {
  const participationType = control._formValues.participants?.[index]?.participation_type;
  const rentalType = control._formValues.participants?.[index]?.rental_type;

  return (
    <div className="border border-border bg-bg-input rounded-md p-4 relative">
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-3 right-3 text-text-dim hover:text-danger transition-colors"
        aria-label="Rimuovi"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <div className="grid md:grid-cols-2 gap-3 mb-3">
        <Select
          label="Socio"
          required
          placeholder="Seleziona socio..."
          options={members.map((m: Member) => ({
            value: m.id,
            label: `${m.last_name} ${m.first_name} (#${m.membership_number})`,
          }))}
          {...register(`participants.${index}.member_id`)}
          error={errors.participants?.[index]?.member_id?.message}
        />
        <Select
          label="Tipo partecipazione"
          required
          options={Object.entries(PARTICIPATION_LABELS).map(([v, l]) => ({ value: v, label: l }))}
          {...register(`participants.${index}.participation_type`)}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-3 mb-3">
        <Select
          label="Noleggio"
          options={Object.entries(RENTAL_LABELS).map(([v, l]) => ({ value: v, label: l }))}
          {...register(`participants.${index}.rental_type`)}
        />
        {rentalType && rentalType !== 'nessuno' && (
          <Input
            label="Prezzo noleggio (€)"
            type="number"
            step="0.01"
            placeholder="0.00"
            {...register(`participants.${index}.rental_price`, { valueAsNumber: true })}
          />
        )}
      </div>

      {/* Selezione attrezzatura specifica (opzionale) */}
      {rentalType && rentalType !== 'nessuno' && equipment.length > 0 && (
        <div className="mb-3">
          <label className="text-xs text-text-muted mb-2 block">
            Attrezzatura specifica assegnata (opzionale)
          </label>
          <Controller
            name={`participants.${index}.equipment_ids`}
            control={control}
            render={({ field }) => (
              <div className="flex flex-wrap gap-2">
                {equipment.map((e: Equipment) => {
                  const checked = field.value?.includes(e.id);
                  return (
                    <button
                      type="button"
                      key={e.id}
                      onClick={() => {
                        const v = field.value || [];
                        field.onChange(
                          checked ? v.filter((x: string) => x !== e.id) : [...v, e.id]
                        );
                      }}
                      className={`text-xs px-2 py-1 rounded border transition-colors ${
                        checked
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border bg-bg text-text-muted hover:border-border-strong'
                      }`}
                    >
                      {e.code} • {EQUIPMENT_LABELS[e.equipment_type]}
                      {e.size && ` ${e.size}`}
                    </button>
                  );
                })}
              </div>
            )}
          />
        </div>
      )}

      <input
        type="text"
        placeholder="Note partecipante (opzionale)"
        {...register(`participants.${index}.notes`)}
        className="w-full bg-bg border border-border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:border-accent"
      />
    </div>
  );
}
