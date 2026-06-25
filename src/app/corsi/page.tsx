'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pencil, Trash2, Loader2, GraduationCap, Euro } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { courseSchema, type CourseFormData } from '@/lib/validation/admin-schemas';
import {
  type Course, type Member, type CourseType, type CourseStatus,
  COURSE_LABELS, COURSE_STATUS_LABELS,
} from '@/lib/types';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

type CourseWithMember = Course & { member?: Pick<Member, 'first_name' | 'last_name'> };

const STATUS_COLORS: Record<CourseStatus, string> = {
  attivo: 'bg-emerald-500/10 text-emerald-400',
  completato: 'bg-blue-500/10 text-blue-400',
  sospeso: 'bg-amber-500/10 text-amber-400',
  annullato: 'bg-zinc-500/10 text-zinc-400',
};

export default function CorsiPage() {
  const supabase = createClient();
  const [items, setItems] = useState<CourseWithMember[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register, handleSubmit, reset, formState: { errors },
  } = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      course_type: 'base', status: 'attivo',
      hours_total: 0, hours_completed: 0, paid: false,
    },
  });

  const load = async () => {
    setLoading(true);
    const [coursesRes, membersRes] = await Promise.all([
      supabase
        .from('courses')
        .select('*, member:members(first_name,last_name)')
        .order('start_date', { ascending: false }),
      supabase
        .from('members')
        .select('id,first_name,last_name')
        .eq('active', true)
        .order('last_name'),
    ]);
    setItems((coursesRes.data as CourseWithMember[]) || []);
    setMembers((membersRes.data as Member[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditing(null);
    setError(null);
    reset({
      member_id: '',
      course_type: 'base',
      status: 'attivo',
      start_date: new Date().toISOString().slice(0, 10),
      end_date: '',
      hours_total: 0,
      hours_completed: 0,
      price: null,
      paid: false,
      payment_date: '',
      notes: '',
    });
    setShowModal(true);
  };

  const openEdit = (item: Course) => {
    setEditing(item);
    setError(null);
    reset({
      member_id: item.member_id,
      course_type: item.course_type,
      status: item.status,
      start_date: item.start_date,
      end_date: item.end_date || '',
      hours_total: item.hours_total,
      hours_completed: item.hours_completed,
      price: item.price,
      paid: item.paid,
      payment_date: item.payment_date || '',
      notes: item.notes || '',
    });
    setShowModal(true);
  };

  const onSubmit = async (data: CourseFormData) => {
    setSubmitting(true);
    setError(null);
    try {
      const url = editing ? `/api/corsi/${editing.id}` : '/api/corsi';
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

  const handleDelete = async (item: Course) => {
    if (!confirm('Eliminare questo corso?')) return;
    const res = await fetch(`/api/corsi/${item.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || 'Errore eliminazione');
      return;
    }
    await load();
  };

  return (
    <div className="p-6 lg:p-10 max-w-6xl pb-24 lg:pb-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Corsi</h1>
          <p className="text-sm text-text-muted mt-1">Iscrizioni e avanzamento corsi soci</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nuovo corso
        </Button>
      </div>

      <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-text-muted" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <GraduationCap className="h-10 w-10 mx-auto text-text-dim mb-3" />
            <p className="text-text-muted">Nessun corso registrato.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((c) => {
              const progress = c.hours_total > 0
                ? Math.min(100, Math.round((c.hours_completed / c.hours_total) * 100))
                : 0;
              return (
                <div key={c.id} className="p-5 hover:bg-bg-elevated/50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-medium text-text">
                          {c.member?.first_name} {c.member?.last_name}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent">
                          {COURSE_LABELS[c.course_type]}
                        </span>
                        <span className={cn('text-xs px-2 py-0.5 rounded', STATUS_COLORS[c.status])}>
                          {COURSE_STATUS_LABELS[c.status]}
                        </span>
                        {c.paid ? (
                          <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
                            <Euro className="h-3 w-3" /> Pagato
                          </span>
                        ) : (
                          c.price && (
                            <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">
                              Da pagare €{c.price}
                            </span>
                          )
                        )}
                      </div>
                      <div className="mt-2 text-xs text-text-muted flex gap-4 flex-wrap">
                        <span>Inizio: {formatDate(c.start_date)}</span>
                        {c.end_date && <span>Fine: {formatDate(c.end_date)}</span>}
                        <span>Ore: {c.hours_completed} / {c.hours_total}</span>
                      </div>
                      {c.hours_total > 0 && (
                        <div className="mt-2 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                          <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      )}
                      {c.notes && <p className="mt-2 text-xs text-text-dim">{c.notes}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEdit(c)} className="p-2 rounded hover:bg-bg-elevated text-text-muted hover:text-text">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(c)} className="p-2 rounded hover:bg-bg-elevated text-text-muted hover:text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Modifica corso' : 'Nuovo corso'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Select label="Socio *" {...register('member_id')} error={errors.member_id?.message}>
            <option value="">— Seleziona socio —</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.last_name} {m.first_name}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-4">
            <Select label="Tipo corso *" {...register('course_type')}>
              {(Object.keys(COURSE_LABELS) as CourseType[]).map((t) => (
                <option key={t} value={t}>{COURSE_LABELS[t]}</option>
              ))}
            </Select>
            <Select label="Stato *" {...register('status')}>
              {(Object.keys(COURSE_STATUS_LABELS) as CourseStatus[]).map((s) => (
                <option key={s} value={s}>{COURSE_STATUS_LABELS[s]}</option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Data inizio *" type="date" {...register('start_date')} error={errors.start_date?.message} />
            <Input label="Data fine" type="date" {...register('end_date')} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input label="Ore totali" type="number" step="0.5" min={0} {...register('hours_total')} />
            <Input label="Ore completate" type="number" step="0.5" min={0} {...register('hours_completed')} />
            <Input label="Prezzo €" type="number" step="0.01" min={0} {...register('price')} />
          </div>

          <div className="grid grid-cols-2 gap-4 items-end">
            <div className="pb-2">
              <Checkbox label="Pagato" {...register('paid')} />
            </div>
            <Input label="Data pagamento" type="date" {...register('payment_date')} />
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
              {editing ? 'Salva' : 'Crea corso'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
