'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pencil, Trash2, Mail, Phone, Award, Loader2, UserCog } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { instructorSchema, type InstructorFormData } from '@/lib/validation/admin-schemas';
import { type Instructor, INSTRUCTOR_ROLE_LABELS } from '@/lib/types';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';

export default function IstruttoriPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Instructor | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InstructorFormData>({
    resolver: zodResolver(instructorSchema),
    defaultValues: { role: 'istruttore', active: true, fiv_certified: false, certifications: [] },
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('instructors')
      .select('*')
      .order('last_name', { ascending: true });
    setItems((data as Instructor[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditing(null);
    setError(null);
    reset({
      first_name: '',
      last_name: '',
      role: 'istruttore',
      fiv_certified: false,
      certifications: [],
      phone: '',
      email: '',
      active: true,
      notes: '',
    });
    setShowModal(true);
  };

  const openEdit = (item: Instructor) => {
    setEditing(item);
    setError(null);
    reset({
      first_name: item.first_name,
      last_name: item.last_name,
      role: item.role,
      fiv_certified: item.fiv_certified,
      certifications: item.certifications || [],
      phone: item.phone || '',
      email: item.email || '',
      active: item.active,
      notes: item.notes || '',
    });
    setShowModal(true);
  };

  const onSubmit = async (data: InstructorFormData) => {
    setSubmitting(true);
    setError(null);
    try {
      const url = editing ? `/api/istruttori/${editing.id}` : '/api/istruttori';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
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

  const handleDelete = async (item: Instructor) => {
    if (!confirm(`Eliminare l'istruttore ${item.first_name} ${item.last_name}?`)) return;
    const res = await fetch(`/api/istruttori/${item.id}`, { method: 'DELETE' });
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
          <h1 className="font-display text-3xl font-bold tracking-tight">Istruttori</h1>
          <p className="text-sm text-text-muted mt-1">
            Istruttori, assistenti e direttori della scuola
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Aggiungi
        </Button>
      </div>

      <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-text-muted">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <UserCog className="h-10 w-10 mx-auto text-text-dim mb-3" />
            <p className="text-text-muted">Nessun istruttore inserito.</p>
            <button
              onClick={openCreate}
              className="text-accent hover:underline text-sm mt-2"
            >
              Aggiungi il primo istruttore
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-5 flex items-start justify-between gap-4 hover:bg-bg-elevated/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-medium text-text">
                      {item.first_name} {item.last_name}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent">
                      {INSTRUCTOR_ROLE_LABELS[item.role]}
                    </span>
                    {item.fiv_certified && (
                      <span className="text-xs px-2 py-0.5 rounded bg-bg-elevated text-text-muted flex items-center gap-1">
                        <Award className="h-3 w-3" />
                        FIV
                      </span>
                    )}
                    {!item.active && (
                      <span className="text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-400">
                        Non attivo
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-text-muted flex-wrap">
                    {item.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {item.email}
                      </span>
                    )}
                    {item.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {item.phone}
                      </span>
                    )}
                  </div>
                  {item.notes && (
                    <p className="mt-2 text-xs text-text-dim">{item.notes}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(item)}
                    className="p-2 rounded hover:bg-bg-elevated text-text-muted hover:text-text"
                    aria-label="Modifica"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    className="p-2 rounded hover:bg-bg-elevated text-text-muted hover:text-red-400"
                    aria-label="Elimina"
                  >
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
        title={editing ? 'Modifica istruttore' : 'Nuovo istruttore'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nome *"
              {...register('first_name')}
              error={errors.first_name?.message}
            />
            <Input
              label="Cognome *"
              {...register('last_name')}
              error={errors.last_name?.message}
            />
          </div>

          <Select label="Ruolo *" {...register('role')} error={errors.role?.message}>
            <option value="istruttore">Istruttore</option>
            <option value="assistente">Assistente</option>
            <option value="direttore">Direttore</option>
          </Select>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Email"
              type="email"
              {...register('email')}
              error={errors.email?.message}
            />
            <Input
              label="Telefono"
              {...register('phone')}
              error={errors.phone?.message}
            />
          </div>

          <div className="space-y-3">
            <Checkbox
              label="Certificato FIV"
              {...register('fiv_certified')}
            />
            <Checkbox
              label="Attivo"
              {...register('active')}
            />
          </div>

          <Textarea
            label="Note"
            {...register('notes')}
            error={errors.notes?.message}
          />

          {error && (
            <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? 'Salva modifiche' : 'Crea istruttore'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
