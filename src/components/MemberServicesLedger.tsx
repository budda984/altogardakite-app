'use client';

import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Plus, Loader2, Receipt, Check, X as XIcon, Euro,
  Trash2, Calendar, ChevronDown, ChevronUp,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import {
  memberServiceSchema, type MemberServiceFormData,
} from '@/lib/validation/admin-schemas';
import {
  type Service, type MemberService, type ServiceCategory, type PaymentMethod,
  SERVICE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS,
} from '@/lib/types';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Props {
  memberId: string;
}

interface ServiceWithCategory extends MemberService {
  service?: Pick<Service, 'name' | 'category'> | null;
}

export default function MemberServicesLedger({ memberId }: Props) {
  const supabase = createClient();
  const [items, setItems] = useState<ServiceWithCategory[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const {
    register, handleSubmit, reset, watch, setValue, formState: { errors },
  } = useForm<MemberServiceFormData>({
    resolver: zodResolver(memberServiceSchema),
    defaultValues: { quantity: 1, paid: false },
  });

  const selectedServiceId = watch('service_id');
  const selectedQty = watch('quantity');

  // Auto-aggiorna unit_price quando si seleziona un servizio
  useEffect(() => {
    if (selectedServiceId) {
      const svc = services.find((s) => s.id === selectedServiceId);
      if (svc) setValue('unit_price', svc.unit_price);
    }
  }, [selectedServiceId, services, setValue]);

  const totalPreview = useMemo(() => {
    const svc = services.find((s) => s.id === selectedServiceId);
    if (!svc) return 0;
    return Number(svc.unit_price) * Number(selectedQty || 1);
  }, [selectedServiceId, selectedQty, services]);

  const load = async () => {
    setLoading(true);
    const [msRes, svcRes] = await Promise.all([
      supabase
        .from('member_services')
        .select('*, service:services(name,category)')
        .eq('member_id', memberId)
        .order('sold_at', { ascending: false }),
      supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .order('name'),
    ]);
    setItems((msRes.data as ServiceWithCategory[]) || []);
    setServices((svcRes.data as Service[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [memberId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bilancio
  const balance = useMemo(() => {
    const charged = items.reduce((acc, i) => acc + Number(i.total_price), 0);
    const paid = items.filter((i) => i.paid).reduce((acc, i) => acc + Number(i.total_price), 0);
    return { charged, paid, outstanding: charged - paid, count: items.length };
  }, [items]);

  // Servizi raggruppati per categoria nel selettore
  const servicesByCategory = useMemo(() => {
    const map: Record<string, Service[]> = {};
    services.forEach((s) => {
      if (!map[s.category]) map[s.category] = [];
      map[s.category].push(s);
    });
    return map;
  }, [services]);

  const openAdd = () => {
    setError(null);
    reset({
      service_id: '',
      quantity: 1,
      unit_price: 0,
      paid: false,
      payment_date: '',
      payment_method: undefined,
      outing_id: null,
      notes: '',
    });
    setShowModal(true);
  };

  const onSubmit = async (data: MemberServiceFormData) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/soci/${memberId}/servizi`, {
        method: 'POST',
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

  const togglePaid = async (item: ServiceWithCategory) => {
    const res = await fetch(`/api/soci/${memberId}/servizi/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paid: !item.paid,
        payment_date: !item.paid ? new Date().toISOString().slice(0, 10) : null,
        payment_method: item.payment_method,
        notes: item.notes || '',
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || 'Errore');
      return;
    }
    await load();
  };

  const handleDelete = async (item: ServiceWithCategory) => {
    if (!confirm(`Eliminare l'addebito "${item.service_name_snapshot}" da € ${item.total_price}?`)) return;
    const res = await fetch(`/api/soci/${memberId}/servizi/${item.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || 'Errore eliminazione');
      return;
    }
    await load();
  };

  const visibleItems = showAll ? items : items.slice(0, 5);

  return (
    <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
      {/* Header con bilancio */}
      <div className="p-5 border-b border-border">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="font-display font-semibold text-lg tracking-tight flex items-center gap-2">
            <Receipt className="h-5 w-5 text-accent" />
            Servizi e pagamenti
          </h2>
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1.5" />
            Addebita
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded bg-bg-elevated border border-border">
            <div className="text-[10px] uppercase tracking-widest text-text-dim">Totale</div>
            <div className="font-display text-xl font-bold mt-1">€ {balance.charged.toFixed(2)}</div>
            <div className="text-[10px] text-text-dim mt-0.5">{balance.count} addebiti</div>
          </div>
          <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/30">
            <div className="text-[10px] uppercase tracking-widest text-emerald-400">Incassato</div>
            <div className="font-display text-xl font-bold mt-1 text-emerald-400">€ {balance.paid.toFixed(2)}</div>
          </div>
          <div className={cn(
            'p-3 rounded border',
            balance.outstanding > 0
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-bg-elevated border-border'
          )}>
            <div className={cn(
              'text-[10px] uppercase tracking-widest',
              balance.outstanding > 0 ? 'text-amber-400' : 'text-text-dim'
            )}>
              Da incassare
            </div>
            <div className={cn(
              'font-display text-xl font-bold mt-1',
              balance.outstanding > 0 ? 'text-amber-400' : 'text-text-dim'
            )}>
              € {balance.outstanding.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Lista addebiti */}
      {loading ? (
        <div className="p-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-text-muted" />
        </div>
      ) : items.length === 0 ? (
        <div className="p-8 text-center text-text-muted text-sm">
          Nessun addebito registrato. Clicca <strong>Addebita</strong> per aggiungere il primo.
        </div>
      ) : (
        <>
          <div className="divide-y divide-border">
            {visibleItems.map((item) => (
              <div key={item.id} className="p-4 hover:bg-bg-elevated/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-text">{item.service_name_snapshot}</span>
                      {item.quantity > 1 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-bg-elevated text-text-muted">
                          ×{item.quantity}
                        </span>
                      )}
                      {item.category && (
                        <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent">
                          {SERVICE_CATEGORY_LABELS[item.category]}
                        </span>
                      )}
                      {item.paid ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          Pagato
                          {item.payment_method && ` · ${PAYMENT_METHOD_LABELS[item.payment_method]}`}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">
                          Da pagare
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-text-muted flex gap-3 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(item.sold_at)}
                      </span>
                      {item.payment_date && (
                        <span>Pagato il {formatDate(item.payment_date)}</span>
                      )}
                      {item.notes && <span className="italic">{item.notes}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="font-display font-semibold text-text flex items-center gap-1">
                        <Euro className="h-3.5 w-3.5" />
                        {Number(item.total_price).toFixed(2)}
                      </div>
                      {item.quantity > 1 && (
                        <div className="text-[10px] text-text-dim">€{Number(item.unit_price).toFixed(2)} cad.</div>
                      )}
                    </div>
                    <button
                      onClick={() => togglePaid(item)}
                      className={cn(
                        'p-1.5 rounded transition-colors',
                        item.paid
                          ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                          : 'bg-bg-elevated text-text-muted hover:text-text'
                      )}
                      title={item.paid ? 'Segna come da pagare' : 'Segna come pagato'}
                    >
                      {item.paid ? <XIcon className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="p-1.5 rounded hover:bg-bg-elevated text-text-muted hover:text-red-400"
                      title="Elimina"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {items.length > 5 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full p-3 text-xs text-text-muted hover:text-text border-t border-border flex items-center justify-center gap-1"
            >
              {showAll ? (
                <>Mostra solo gli ultimi 5 <ChevronUp className="h-3 w-3" /></>
              ) : (
                <>Mostra tutti i {items.length} addebiti <ChevronDown className="h-3 w-3" /></>
              )}
            </button>
          )}
        </>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Nuovo addebito"
        description="Aggiungi un servizio al conto del socio"
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Select label="Servizio *" {...register('service_id')} error={errors.service_id?.message}>
            <option value="">— Seleziona servizio —</option>
            {(Object.entries(servicesByCategory) as [ServiceCategory, Service[]][]).map(([cat, svcs]) => (
              <optgroup key={cat} label={SERVICE_CATEGORY_LABELS[cat]}>
                {svcs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — €{Number(s.unit_price).toFixed(2)}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Quantita"
              type="number"
              min={1}
              {...register('quantity')}
              error={errors.quantity?.message}
              hint="Es. 3 lift singoli"
            />
            <Input
              label="Prezzo unitario €"
              type="number"
              step="0.01"
              min={0}
              {...register('unit_price')}
              error={errors.unit_price?.message}
              hint="Modificabile per sconti"
            />
          </div>

          {totalPreview > 0 && (
            <div className="p-3 rounded bg-accent/10 border border-accent/30 flex items-center justify-between">
              <span className="text-sm text-text-muted">Totale</span>
              <span className="font-display text-2xl font-bold text-accent flex items-center gap-1">
                <Euro className="h-5 w-5" />
                {totalPreview.toFixed(2)}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 items-end">
            <div className="pb-2">
              <Checkbox label="Pagato subito" {...register('paid')} />
            </div>
            <Select label="Metodo pagamento" {...register('payment_method')}>
              <option value="">— Non specificato —</option>
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
              ))}
            </Select>
          </div>

          <Input label="Data pagamento" type="date" {...register('payment_date')} />

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
              Addebita
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
