'use client';

import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Plus, Pencil, Trash2, Loader2, Tag, Euro, EyeOff, Sparkles,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { serviceSchema, type ServiceFormData } from '@/lib/validation/admin-schemas';
import {
  type Service, type ServiceCategory,
  SERVICE_CATEGORY_LABELS,
} from '@/lib/types';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';

function slugify(t: string): string {
  return t.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export default function ServiziPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const {
    register, handleSubmit, reset, watch, setValue, formState: { errors },
  } = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: { category: 'altro', is_active: true, is_subscription: false, included_lifts: 0, sort_order: 0 },
  });
  const watchedName = watch('name');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('services')
      .select('*')
      .order('sort_order')
      .order('name');
    setItems((data as Service[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = useMemo(() => {
    const filtered = showInactive ? items : items.filter((s) => s.is_active);
    const map: Record<string, Service[]> = {};
    filtered.forEach((s) => {
      if (!map[s.category]) map[s.category] = [];
      map[s.category].push(s);
    });
    return map;
  }, [items, showInactive]);

  const openCreate = () => {
    setEditing(null);
    setError(null);
    reset({
      slug: '', name: '', category: 'altro',
      unit_price: 0, included_lifts: 0,
      is_subscription: false,
      description: '', is_active: true, sort_order: 0,
    });
    setShowModal(true);
  };

  const openEdit = (item: Service) => {
    setEditing(item);
    setError(null);
    reset({
      slug: item.slug,
      name: item.name,
      category: item.category,
      unit_price: item.unit_price,
      included_lifts: item.included_lifts,
      is_subscription: item.is_subscription,
      description: item.description || '',
      is_active: item.is_active,
      sort_order: item.sort_order,
    });
    setShowModal(true);
  };

  // Auto-genera slug dal nome (solo in creazione, e solo se l'utente non l'ha gia toccato)
  useEffect(() => {
    if (!editing && watchedName && !watch('slug')) {
      setValue('slug', slugify(watchedName));
    }
  }, [watchedName, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (data: ServiceFormData) => {
    setSubmitting(true);
    setError(null);
    try {
      const url = editing ? `/api/servizi/${editing.id}` : '/api/servizi';
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

  const handleDelete = async (item: Service) => {
    if (!confirm(`Eliminare "${item.name}"?\n\nNB: gli addebiti gia registrati con questo servizio rimarranno (con snapshot del nome).`)) return;
    const res = await fetch(`/api/servizi/${item.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || 'Errore eliminazione');
      return;
    }
    await load();
  };

  const handleToggleActive = async (item: Service) => {
    const res = await fetch(`/api/servizi/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...item, is_active: !item.is_active }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || 'Errore');
      return;
    }
    await load();
  };

  return (
    <div className="p-6 lg:p-10 max-w-6xl pb-24 lg:pb-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Listino servizi</h1>
          <p className="text-sm text-text-muted mt-1">
            Catalogo lift, noleggi, pacchetti e storage. Aggiornabile per ogni stagione.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nuovo servizio
        </Button>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <Checkbox
          label="Mostra anche servizi disattivati"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
        />
        <span className="text-xs text-text-dim">{items.filter((s) => s.is_active).length} servizi attivi</span>
      </div>

      {loading ? (
        <div className="p-12 text-center bg-bg-surface border border-border rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-text-muted" />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="p-12 text-center bg-bg-surface border border-border rounded-lg">
          <Tag className="h-10 w-10 mx-auto text-text-dim mb-3" />
          <p className="text-text-muted">Nessun servizio nel listino.</p>
          <button onClick={openCreate} className="text-accent hover:underline text-sm mt-2">
            Aggiungi il primo servizio
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {(Object.entries(grouped) as [ServiceCategory, Service[]][]).map(([cat, services]) => (
            <div key={cat} className="bg-bg-surface border border-border rounded-lg overflow-hidden">
              <div className="px-5 py-3 bg-bg-elevated/50 border-b border-border">
                <h2 className="font-display font-semibold tracking-tight text-text">
                  {SERVICE_CATEGORY_LABELS[cat]}
                </h2>
                <p className="text-[10px] uppercase tracking-widest text-text-dim mt-0.5">
                  {services.length} {services.length === 1 ? 'voce' : 'voci'}
                </p>
              </div>
              <div className="divide-y divide-border">
                {services.map((s) => (
                  <div
                    key={s.id}
                    className={cn(
                      'p-4 flex items-start justify-between gap-4 hover:bg-bg-elevated/30',
                      !s.is_active && 'opacity-60'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-medium text-text">{s.name}</span>
                        {s.is_subscription && (
                          <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            Abbonamento
                          </span>
                        )}
                        {!s.is_subscription && s.included_lifts > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded bg-bg-elevated text-text-muted">
                            {s.included_lifts} lift
                          </span>
                        )}
                        {!s.is_active && (
                          <span className="text-xs px-2 py-0.5 rounded bg-zinc-500/10 text-zinc-400 flex items-center gap-1">
                            <EyeOff className="h-3 w-3" /> Disattivo
                          </span>
                        )}
                      </div>
                      {s.description && (
                        <p className="mt-1 text-xs text-text-dim">{s.description}</p>
                      )}
                      <code className="text-[10px] text-text-dim font-mono mt-1 inline-block">{s.slug}</code>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-lg font-display font-semibold text-accent flex items-center gap-1">
                          <Euro className="h-4 w-4" />
                          {Number(s.unit_price).toFixed(2)}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleToggleActive(s)}
                          className="p-1.5 rounded hover:bg-bg-elevated text-text-muted hover:text-text"
                          title={s.is_active ? 'Disattiva' : 'Riattiva'}
                        >
                          <EyeOff className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => openEdit(s)} className="p-1.5 rounded hover:bg-bg-elevated text-text-muted hover:text-text">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(s)} className="p-1.5 rounded hover:bg-bg-elevated text-text-muted hover:text-red-400">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Modifica servizio' : 'Nuovo servizio'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Input
            label="Nome *"
            placeholder="es. Lift singolo kite o wing"
            {...register('name')}
            error={errors.name?.message}
          />

          <Input
            label="Slug tecnico *"
            placeholder="es. lift_singolo_kw"
            {...register('slug')}
            error={errors.slug?.message}
            hint="Solo minuscole, numeri e underscore. Generato dal nome."
          />

          <div className="grid grid-cols-2 gap-4">
            <Select label="Categoria *" {...register('category')}>
              {(Object.keys(SERVICE_CATEGORY_LABELS) as ServiceCategory[]).map((c) => (
                <option key={c} value={c}>{SERVICE_CATEGORY_LABELS[c]}</option>
              ))}
            </Select>
            <Input
              label="Prezzo €"
              type="number"
              step="0.01"
              min={0}
              {...register('unit_price')}
              error={errors.unit_price?.message}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Lift inclusi (per pacchetti)"
              type="number"
              min={0}
              {...register('included_lifts')}
              hint="0 se non e un pacchetto lift"
            />
            <Input
              label="Ordine visualizzazione"
              type="number"
              {...register('sort_order')}
              hint="Numeri piu bassi = prima nell'elenco"
            />
          </div>

          <div className="p-3 rounded bg-bg-elevated border border-border space-y-2">
            <Checkbox
              label="È un abbonamento stagionale (lift illimitati nella finestra di validità)"
              {...register('is_subscription')}
            />
            <p className="text-xs text-text-dim pl-6">
              Spunta solo se il servizio è uno stagionale tipo &quot;Pacchetto lift stagionale kite&quot; o &quot;Storage stagionale&quot;.
              Per gli abbonamenti i lift inclusi vengono ignorati: contano solo le date di validità.
            </p>
          </div>

          <Textarea label="Descrizione" {...register('description')} />

          <Checkbox label="Attivo" {...register('is_active')} />

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
              {editing ? 'Salva' : 'Crea servizio'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
