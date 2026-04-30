'use client';

import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pencil, Trash2, Loader2, Package, Search } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { equipmentSchema, type EquipmentFormData } from '@/lib/validation/admin-schemas';
import { type Equipment, type EquipmentType, EQUIPMENT_LABELS, EQUIPMENT_STATUS_LABELS } from '@/lib/types';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  disponibile: 'bg-emerald-500/10 text-emerald-400',
  in_uso: 'bg-blue-500/10 text-blue-400',
  manutenzione: 'bg-amber-500/10 text-amber-400',
  dismesso: 'bg-zinc-500/10 text-zinc-400',
};

export default function AttrezzaturaPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<EquipmentType | 'all'>('all');
  const [search, setSearch] = useState('');

  const {
    register, handleSubmit, reset, formState: { errors },
  } = useForm<EquipmentFormData>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: { equipment_type: 'kite', status: 'disponibile' },
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('equipment')
      .select('*')
      .order('equipment_type')
      .order('code');
    setItems((data as Equipment[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    let out = items;
    if (filterType !== 'all') out = out.filter((e) => e.equipment_type === filterType);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((e) =>
        e.code.toLowerCase().includes(q) ||
        (e.brand || '').toLowerCase().includes(q) ||
        (e.model || '').toLowerCase().includes(q) ||
        (e.size || '').toLowerCase().includes(q)
      );
    }
    return out;
  }, [items, filterType, search]);

  const grouped = useMemo(() => {
    const map: Record<string, Equipment[]> = {};
    filtered.forEach((e) => {
      if (!map[e.equipment_type]) map[e.equipment_type] = [];
      map[e.equipment_type].push(e);
    });
    return map;
  }, [filtered]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    items.forEach((e) => { c[e.equipment_type] = (c[e.equipment_type] || 0) + 1; });
    return c;
  }, [items]);

  const openCreate = () => {
    setEditing(null);
    setError(null);
    reset({
      code: '', equipment_type: 'kite', brand: '', model: '', size: '',
      year: null, serial_number: '', status: 'disponibile', purchase_date: '', notes: '',
    });
    setShowModal(true);
  };

  const openEdit = (item: Equipment) => {
    setEditing(item);
    setError(null);
    reset({
      code: item.code,
      equipment_type: item.equipment_type,
      brand: item.brand || '',
      model: item.model || '',
      size: item.size || '',
      year: item.year,
      serial_number: item.serial_number || '',
      status: item.status,
      purchase_date: item.purchase_date || '',
      notes: item.notes || '',
    });
    setShowModal(true);
  };

  const onSubmit = async (data: EquipmentFormData) => {
    setSubmitting(true);
    setError(null);
    try {
      const url = editing ? `/api/attrezzatura/${editing.id}` : '/api/attrezzatura';
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

  const handleDelete = async (item: Equipment) => {
    if (!confirm(`Eliminare l'attrezzatura "${item.code}"?`)) return;
    const res = await fetch(`/api/attrezzatura/${item.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || 'Errore eliminazione');
      return;
    }
    await load();
  };

  const types: (EquipmentType | 'all')[] = [
    'all', 'kite', 'tavola', 'wing', 'foil', 'barra', 'trapezio',
    'muta', 'giubbotto', 'casco', 'sup', 'altro',
  ];

  return (
    <div className="p-6 lg:p-10 max-w-7xl pb-24 lg:pb-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Attrezzatura</h1>
          <p className="text-sm text-text-muted mt-1">Inventario completo della scuola</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Aggiungi
        </Button>
      </div>

      <div className="mb-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-dim" />
          <input
            placeholder="Cerca per codice, marca, modello, taglia..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-md border border-border bg-bg-elevated text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={cn(
                'px-3 py-1.5 rounded text-xs font-medium transition-colors',
                filterType === t
                  ? 'bg-accent text-bg'
                  : 'bg-bg-elevated text-text-muted hover:text-text'
              )}
            >
              {t === 'all' ? 'Tutti' : EQUIPMENT_LABELS[t as EquipmentType]} ({counts[t] || 0})
            </button>
          ))}
        </div>
      </div>

      <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-text-muted" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="h-10 w-10 mx-auto text-text-dim mb-3" />
            <p className="text-text-muted">Nessuna attrezzatura.</p>
            {items.length === 0 && (
              <button onClick={openCreate} className="text-accent hover:underline text-sm mt-2">
                Aggiungi il primo articolo
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {Object.entries(grouped).map(([type, equipments]) => (
              <div key={type}>
                <div className="px-5 py-2 bg-bg-elevated/50 text-[11px] uppercase tracking-widest text-text-dim font-medium">
                  {EQUIPMENT_LABELS[type as EquipmentType]} · {equipments.length}
                </div>
                <div className="divide-y divide-border">
                  {equipments.map((e) => (
                    <div key={e.id} className="p-4 flex items-start justify-between gap-3 hover:bg-bg-elevated/30">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm text-accent">{e.code}</span>
                          {e.brand && <span className="text-sm text-text">{e.brand}</span>}
                          {e.model && <span className="text-sm text-text-muted">{e.model}</span>}
                          {e.size && <span className="text-xs px-1.5 py-0.5 rounded bg-bg-elevated text-text-muted">{e.size}</span>}
                          <span className={cn('text-xs px-2 py-0.5 rounded', STATUS_COLORS[e.status])}>
                            {EQUIPMENT_STATUS_LABELS[e.status]}
                          </span>
                        </div>
                        {(e.year || e.serial_number || e.notes) && (
                          <div className="mt-1.5 text-xs text-text-dim flex gap-3 flex-wrap">
                            {e.year && <span>{e.year}</span>}
                            {e.serial_number && <span>SN: {e.serial_number}</span>}
                            {e.notes && <span className="italic">{e.notes}</span>}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => openEdit(e)} className="p-1.5 rounded hover:bg-bg-elevated text-text-muted hover:text-text">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(e)} className="p-1.5 rounded hover:bg-bg-elevated text-text-muted hover:text-red-400">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Modifica attrezzatura' : 'Nuova attrezzatura'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Codice * (es. K-001)" {...register('code')} error={errors.code?.message} />
            <Select label="Tipo *" {...register('equipment_type')} error={errors.equipment_type?.message}>
              {(Object.keys(EQUIPMENT_LABELS) as EquipmentType[]).map((t) => (
                <option key={t} value={t}>{EQUIPMENT_LABELS[t]}</option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input label="Marca" {...register('brand')} />
            <Input label="Modello" {...register('model')} />
            <Input label="Taglia (es. 9m, M)" {...register('size')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Anno" type="number" min={1990} max={2100} {...register('year')} />
            <Input label="Numero seriale" {...register('serial_number')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select label="Stato *" {...register('status')}>
              {Object.entries(EQUIPMENT_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
            <Input label="Data acquisto" type="date" {...register('purchase_date')} />
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
              {editing ? 'Salva' : 'Crea articolo'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
