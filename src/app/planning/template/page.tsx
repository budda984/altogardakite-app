'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Plus, Pencil, Trash2, Loader2, Settings, ArrowLeft, Wind, EyeOff,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import {
  sessionTemplateSchema, type SessionTemplateFormData,
} from '@/lib/validation/admin-schemas';
import {
  type SessionTemplate, type LiftDiscipline, type WindSession,
  DISCIPLINE_LABELS, WIND_SESSION_LABELS,
} from '@/lib/types';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';

export default function TemplateSessioniPage() {
  const supabase = createClient();
  const [items, setItems] = useState<SessionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SessionTemplate | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register, handleSubmit, reset, formState: { errors },
  } = useForm<SessionTemplateFormData>({
    resolver: zodResolver(sessionTemplateSchema),
    defaultValues: {
      discipline: 'kite',
      is_default: true,
      is_active: true,
      sort_order: 0,
    },
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('session_templates')
      .select('*')
      .order('sort_order')
      .order('name');
    setItems((data as SessionTemplate[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditing(null);
    setError(null);
    reset({
      name: '',
      discipline: 'kite',
      wind_session: null,
      default_departure_time: '09:00',
      default_return_time: '12:00',
      sort_order: 0,
      is_default: true,
      is_active: true,
      notes: '',
    });
    setShowModal(true);
  };

  const openEdit = (item: SessionTemplate) => {
    setEditing(item);
    setError(null);
    reset({
      name: item.name,
      discipline: item.discipline,
      wind_session: item.wind_session,
      default_departure_time: item.default_departure_time.slice(0, 5),
      default_return_time: item.default_return_time.slice(0, 5),
      sort_order: item.sort_order,
      is_default: item.is_default,
      is_active: item.is_active,
      notes: item.notes || '',
    });
    setShowModal(true);
  };

  const onSubmit = async (data: SessionTemplateFormData) => {
    setSubmitting(true);
    setError(null);
    try {
      const url = editing ? `/api/sessione-template/${editing.id}` : '/api/sessione-template';
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Errore salvataggio');
      }
      await load();
      setShowModal(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item: SessionTemplate) => {
    if (!confirm(`Eliminare il template "${item.name}"?`)) return;
    const res = await fetch(`/api/sessione-template/${item.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || 'Errore');
      return;
    }
    await load();
  };

  return (
    <div className="p-6 lg:p-10 max-w-5xl pb-24 lg:pb-10">
      <div className="mb-6">
        <Link href="/planning" className="text-sm text-text-muted hover:text-text inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          Torna al planning
        </Link>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-3">
            <Settings className="h-7 w-7 text-accent" />
            Template sessioni
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Configura le sessioni standard giornaliere e i loro orari (modificabili per stagione)
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nuovo template
        </Button>
      </div>

      <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-text-muted" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <Settings className="h-10 w-10 mx-auto text-text-dim mb-3" />
            <p className="text-text-muted">Nessun template configurato.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((t) => (
              <div
                key={t.id}
                className={cn(
                  'p-5 flex items-start justify-between gap-4 hover:bg-bg-elevated/30',
                  !t.is_active && 'opacity-50'
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-display text-lg font-semibold tracking-tight">{t.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent">
                      {DISCIPLINE_LABELS[t.discipline]}
                    </span>
                    {t.wind_session && (
                      <span className="text-xs px-2 py-0.5 rounded bg-bg-elevated text-text-muted flex items-center gap-1">
                        <Wind className="h-3 w-3" />
                        {WIND_SESSION_LABELS[t.wind_session]}
                      </span>
                    )}
                    {t.is_default && (
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                        Default giornaliero
                      </span>
                    )}
                    {!t.is_active && (
                      <span className="text-xs px-2 py-0.5 rounded bg-zinc-500/10 text-zinc-400 flex items-center gap-1">
                        <EyeOff className="h-3 w-3" />
                        Disattivo
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-text-muted mt-2">
                    Orario standard: <strong className="text-text">
                      {t.default_departure_time.slice(0, 5)} – {t.default_return_time.slice(0, 5)}
                    </strong>
                    {' · ordine '}{t.sort_order}
                  </div>
                  {t.notes && (
                    <p className="text-xs text-text-dim mt-1">{t.notes}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(t)} className="p-2 rounded hover:bg-bg-elevated text-text-muted hover:text-text">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(t)} className="p-2 rounded hover:bg-bg-elevated text-text-muted hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Modifica template' : 'Nuovo template sessione'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Input
            label="Nome *"
            placeholder="es. Peler, Ora, Wingfoil mattina"
            {...register('name')}
            error={errors.name?.message}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select label="Disciplina *" {...register('discipline')}>
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

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Orario partenza standard *"
              type="time"
              {...register('default_departure_time')}
              error={errors.default_departure_time?.message}
            />
            <Input
              label="Orario rientro standard *"
              type="time"
              {...register('default_return_time')}
              error={errors.default_return_time?.message}
            />
          </div>

          <Input
            label="Ordine visualizzazione"
            type="number"
            {...register('sort_order')}
            hint="Numeri piu bassi = prima nella giornata"
          />

          <div className="space-y-3">
            <Checkbox
              label="Genera automaticamente ogni giorno (default)"
              {...register('is_default')}
            />
            <p className="text-xs text-text-dim pl-6 -mt-2">
              Se attivo, comparira nel planning di tutti i giorni e potra essere creato in massa con il pulsante &quot;Genera giorno standard&quot;.
            </p>
            <Checkbox label="Attivo" {...register('is_active')} />
          </div>

          <Textarea label="Note" {...register('notes')} />

          {error && (
            <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>Annulla</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? 'Salva' : 'Crea template'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
