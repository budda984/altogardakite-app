'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pencil, Trash2, Loader2, Anchor, Users } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { boatSchema, type BoatFormData } from '@/lib/validation/admin-schemas';
import { type Boat, BOAT_LABELS } from '@/lib/types';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';

export default function BarchePage() {
  const supabase = createClient();
  const [items, setItems] = useState<Boat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Boat | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register, handleSubmit, reset, formState: { errors },
  } = useForm<BoatFormData>({
    resolver: zodResolver(boatSchema),
    defaultValues: { boat_type: 'nuova_jolly', active: true },
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('boats').select('*').order('name');
    setItems((data as Boat[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditing(null);
    setError(null);
    reset({ name: '', boat_type: 'nuova_jolly', registration: '', capacity: null, active: true, notes: '' });
    setShowModal(true);
  };

  const openEdit = (item: Boat) => {
    setEditing(item);
    setError(null);
    reset({
      name: item.name,
      boat_type: item.boat_type,
      registration: item.registration || '',
      capacity: item.capacity,
      active: item.active,
      notes: item.notes || '',
    });
    setShowModal(true);
  };

  const onSubmit = async (data: BoatFormData) => {
    setSubmitting(true);
    setError(null);
    try {
      const url = editing ? `/api/barche/${editing.id}` : '/api/barche';
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

  const handleDelete = async (item: Boat) => {
    if (!confirm(`Eliminare l'imbarcazione "${item.name}"?`)) return;
    const res = await fetch(`/api/barche/${item.id}`, { method: 'DELETE' });
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
          <h1 className="font-display text-3xl font-bold tracking-tight">Imbarcazioni</h1>
          <p className="text-sm text-text-muted mt-1">Flotta della scuola</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Aggiungi
        </Button>
      </div>

      <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-text-muted" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <Anchor className="h-10 w-10 mx-auto text-text-dim mb-3" />
            <p className="text-text-muted">Nessuna imbarcazione registrata.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item) => (
              <div key={item.id} className="p-5 flex items-start justify-between gap-4 hover:bg-bg-elevated/50">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-medium text-text">{item.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent">
                      {BOAT_LABELS[item.boat_type]}
                    </span>
                    {!item.active && (
                      <span className="text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-400">
                        Non attiva
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-text-muted flex-wrap">
                    {item.registration && <span>Targa: {item.registration}</span>}
                    {item.capacity && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        Capienza {item.capacity}
                      </span>
                    )}
                  </div>
                  {item.notes && <p className="mt-2 text-xs text-text-dim">{item.notes}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(item)} className="p-2 rounded hover:bg-bg-elevated text-text-muted hover:text-text">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(item)} className="p-2 rounded hover:bg-bg-elevated text-text-muted hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Modifica imbarcazione' : 'Nuova imbarcazione'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nome *" {...register('name')} error={errors.name?.message} />
            <Select label="Tipo *" {...register('boat_type')} error={errors.boat_type?.message}>
              <option value="nuova_jolly">Nuova Jolly</option>
              <option value="lomac">Lomac</option>
              <option value="pontoon">Pontoon</option>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Targa / Immatricolazione" {...register('registration')} />
            <Input label="Capienza (persone)" type="number" min={1} max={50} {...register('capacity')} />
          </div>

          <Checkbox label="Attiva" {...register('active')} />

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
              {editing ? 'Salva' : 'Crea imbarcazione'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
