'use client';

import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Plus, Loader2, Wallet, Euro, Package as PackageIcon, Receipt,
  AlertCircle, CheckCircle2, ArrowDown, ArrowUp, ChevronDown, ChevronUp,
  Wind, Banknote,
} from 'lucide-react';

import {
  purchasePackageSchema, chargeServiceSchema, paymentSchema,
  type PurchasePackageFormData, type ChargeServiceFormData, type PaymentFormData,
} from '@/lib/validation/admin-schemas';
import {
  type Service, type Package, type Movement, type MemberWallet,
  type LiftBalance, type ServiceCategory, type PaymentMethod, type LiftDiscipline,
  type MovementType,
  SERVICE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS, DISCIPLINE_LABELS,
  MOVEMENT_TYPE_LABELS,
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
  services: Service[];
}

interface WalletData {
  wallet: MemberWallet | null;
  lift_balances: LiftBalance[];
  packages: Package[];
  movements: Movement[];
}

type ModalMode = null | 'package' | 'charge' | 'payment';

export default function MemberWalletPanel({ memberId, services }: Props) {
  const [data, setData] = useState<WalletData>({
    wallet: null, lift_balances: [], packages: [], movements: [],
  });
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [showAllMovements, setShowAllMovements] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/soci/${memberId}/wallet`);
    if (res.ok) {
      setData(await res.json());
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [memberId]); // eslint-disable-line react-hooks/exhaustive-deps

  const monetaryBalance = Number(data.wallet?.monetary_balance || 0);
  const outstanding = Number(data.wallet?.total_outstanding || 0);
  const isInDebt = monetaryBalance < 0;

  const visibleMovements = showAllMovements ? data.movements : data.movements.slice(0, 8);

  // Filtra pacchetti attivi (con lift residui)
  const activePackages = data.packages.filter((p) => !p.is_exhausted);
  const exhaustedPackages = data.packages.filter((p) => p.is_exhausted);

  return (
    <div className="space-y-6">
      {/* Header con saldi principali */}
      <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
        <div className="p-5 border-b border-border">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h2 className="font-display font-semibold text-lg tracking-tight flex items-center gap-2">
              <Wallet className="h-5 w-5 text-accent" />
              Wallet del socio
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setModalMode('package')}>
                <PackageIcon className="h-3.5 w-3.5 mr-1.5" />
                Acquista pacchetto
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setModalMode('charge')}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Addebito singolo
              </Button>
              <Button size="sm" onClick={() => setModalMode('payment')}>
                <Banknote className="h-3.5 w-3.5 mr-1.5" />
                Registra pagamento
              </Button>
            </div>
          </div>

          {/* KPI bilancio monetario */}
          <div className={cn(
            'p-4 rounded-md border',
            isInDebt
              ? 'bg-amber-500/10 border-amber-500/30'
              : monetaryBalance > 0
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-bg-elevated border-border'
          )}>
            <div className="flex items-center justify-between">
              <div>
                <div className={cn(
                  'text-[10px] uppercase tracking-widest',
                  isInDebt ? 'text-amber-400' : monetaryBalance > 0 ? 'text-emerald-400' : 'text-text-dim'
                )}>
                  {isInDebt ? 'Da incassare' : monetaryBalance > 0 ? 'A credito' : 'Saldo zero'}
                </div>
                <div className={cn(
                  'font-display text-3xl font-bold mt-1',
                  isInDebt ? 'text-amber-400' : monetaryBalance > 0 ? 'text-emerald-400' : 'text-text'
                )}>
                  € {Math.abs(monetaryBalance).toFixed(2)}
                </div>
              </div>
              {isInDebt && (
                <AlertCircle className="h-8 w-8 text-amber-400 opacity-50" />
              )}
              {monetaryBalance > 0 && (
                <CheckCircle2 className="h-8 w-8 text-emerald-400 opacity-50" />
              )}
            </div>
            <div className="text-xs text-text-muted mt-2">
              Totale incassato: € {Number(data.wallet?.total_received || 0).toFixed(2)} ·{' '}
              {data.movements.length} movimenti
            </div>
          </div>
        </div>

        {/* Lift residui per disciplina */}
        {data.lift_balances.length > 0 && (
          <div className="p-5 border-b border-border">
            <h3 className="text-[10px] uppercase tracking-widest text-text-dim font-medium mb-3 flex items-center gap-2">
              <Wind className="h-3 w-3" />
              Lift residui
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {data.lift_balances.map((b) => {
                const isEmpty = b.lifts_remaining === 0;
                return (
                  <div
                    key={b.discipline}
                    className={cn(
                      'p-3 rounded border',
                      isEmpty
                        ? 'bg-bg-elevated border-border opacity-50'
                        : 'bg-accent/5 border-accent/30'
                    )}
                  >
                    <div className="text-[10px] uppercase tracking-widest text-text-dim">
                      {DISCIPLINE_LABELS[b.discipline]}
                    </div>
                    <div className="font-display text-2xl font-bold mt-1">
                      <span className={cn(isEmpty ? 'text-text-dim' : 'text-accent')}>
                        {b.lifts_remaining}
                      </span>
                      <span className="text-text-dim text-base"> / {b.lifts_total}</span>
                    </div>
                    <div className="text-[10px] text-text-dim mt-0.5">
                      {b.packages_active} {b.packages_active === 1 ? 'pacchetto attivo' : 'pacchetti attivi'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pacchetti attivi (dettaglio) */}
        {activePackages.length > 0 && (
          <div className="p-5 border-b border-border">
            <h3 className="text-[10px] uppercase tracking-widest text-text-dim font-medium mb-3">
              Pacchetti attivi
            </h3>
            <div className="space-y-2">
              {activePackages.map((p) => {
                const remaining = p.lifts_total - p.lifts_used;
                const pctUsed = p.lifts_total > 0 ? (p.lifts_used / p.lifts_total) * 100 : 0;
                return (
                  <div key={p.id} className="p-3 rounded bg-bg-elevated border border-border">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm text-text">{p.service_name_snapshot}</div>
                        <div className="text-[10px] text-text-dim mt-0.5">
                          Acquistato il {formatDate(p.created_at)} · € {Number(p.total_price).toFixed(2)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-display font-bold text-accent">
                          {remaining}
                        </div>
                        <div className="text-[10px] text-text-dim">su {p.lifts_total}</div>
                      </div>
                    </div>
                    <div className="h-1 bg-bg rounded overflow-hidden">
                      <div
                        className="h-full bg-accent transition-all"
                        style={{ width: `${100 - pctUsed}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Storico movimenti */}
        <div className="p-5">
          <h3 className="text-[10px] uppercase tracking-widest text-text-dim font-medium mb-3 flex items-center gap-2">
            <Receipt className="h-3 w-3" />
            Movimenti
          </h3>

          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-5 w-5 animate-spin mx-auto text-text-muted" />
            </div>
          ) : data.movements.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-6">
              Nessun movimento. Inizia con un acquisto pacchetto, addebito o pagamento.
            </p>
          ) : (
            <>
              <div className="divide-y divide-border">
                {visibleMovements.map((m) => (
                  <MovementRow key={m.id} movement={m} memberId={memberId} onUpdate={load} />
                ))}
              </div>
              {data.movements.length > 8 && (
                <button
                  onClick={() => setShowAllMovements(!showAllMovements)}
                  className="w-full mt-3 p-2 text-xs text-text-muted hover:text-text border-t border-border flex items-center justify-center gap-1"
                >
                  {showAllMovements ? (
                    <>Mostra solo gli ultimi 8 <ChevronUp className="h-3 w-3" /></>
                  ) : (
                    <>Mostra tutti i {data.movements.length} movimenti <ChevronDown className="h-3 w-3" /></>
                  )}
                </button>
              )}
            </>
          )}

          {exhaustedPackages.length > 0 && (
            <details className="mt-4 pt-4 border-t border-border">
              <summary className="text-xs text-text-dim cursor-pointer hover:text-text">
                Pacchetti esauriti ({exhaustedPackages.length})
              </summary>
              <div className="mt-2 space-y-1">
                {exhaustedPackages.map((p) => (
                  <div key={p.id} className="text-xs text-text-dim p-2 rounded bg-bg-elevated/50">
                    {p.service_name_snapshot} · {p.lifts_total}/{p.lifts_total} usati ·{' '}
                    {formatDate(p.created_at)}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>

      <PurchasePackageModal
        open={modalMode === 'package'}
        onClose={() => setModalMode(null)}
        memberId={memberId}
        services={services.filter((s) => s.included_lifts > 0 && s.is_active)}
        onSuccess={load}
      />
      <ChargeServiceModal
        open={modalMode === 'charge'}
        onClose={() => setModalMode(null)}
        memberId={memberId}
        services={services.filter((s) => s.is_active)}
        onSuccess={load}
      />
      <PaymentModal
        open={modalMode === 'payment'}
        onClose={() => setModalMode(null)}
        memberId={memberId}
        suggestedAmount={isInDebt ? Math.abs(monetaryBalance) : 0}
        onSuccess={load}
      />
    </div>
  );
}

// ============================================================================
// MOVEMENT ROW
// ============================================================================
function MovementRow({
  movement, memberId, onUpdate,
}: { movement: Movement; memberId: string; onUpdate: () => void }) {
  const [paying, setPaying] = useState(false);
  const isCredit = Number(movement.amount) > 0;
  const isDebit = Number(movement.amount) < 0;
  const isLiftConsume = movement.movement_type === 'consumo_lift';
  const isUnpaidDebit = isDebit && !movement.paid;

  const handlePay = async (method: PaymentMethod) => {
    setPaying(true);
    try {
      const res = await fetch(`/api/soci/${memberId}/movimenti/${movement.id}/saldo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_method: method }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || 'Errore');
        return;
      }
      onUpdate();
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="py-3 flex items-start gap-3">
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
        isCredit ? 'bg-emerald-500/10 text-emerald-400' :
        isDebit ? 'bg-amber-500/10 text-amber-400' :
        'bg-bg-elevated text-text-muted'
      )}>
        {isCredit ? <ArrowUp className="h-4 w-4" /> :
         isDebit ? <ArrowDown className="h-4 w-4" /> :
         <Wind className="h-4 w-4" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-text">{movement.description}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated text-text-muted">
                {MOVEMENT_TYPE_LABELS[movement.movement_type]}
              </span>
              {isUnpaidDebit && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                  Da pagare
                </span>
              )}
            </div>
            <div className="text-[10px] text-text-dim mt-0.5">
              {formatDate(movement.movement_date)}
              {movement.payment_method && ` · ${PAYMENT_METHOD_LABELS[movement.payment_method]}`}
              {movement.notes && ` · ${movement.notes}`}
            </div>
          </div>

          <div className="text-right shrink-0">
            {Number(movement.amount) !== 0 && (
              <div className={cn(
                'font-display font-semibold flex items-center gap-1',
                isCredit ? 'text-emerald-400' : 'text-amber-400'
              )}>
                <Euro className="h-3 w-3" />
                {isCredit ? '+' : '−'}
                {Math.abs(Number(movement.amount)).toFixed(2)}
              </div>
            )}
            {isLiftConsume && (
              <div className="text-xs text-text-muted">
                −1 lift {movement.lift_discipline}
              </div>
            )}
            {Number(movement.lift_delta) > 0 && (
              <div className="text-xs text-emerald-400">
                +{movement.lift_delta} lift {movement.lift_discipline}
              </div>
            )}

            {isUnpaidDebit && !paying && (
              <div className="mt-1 flex gap-1 justify-end">
                <button
                  onClick={() => handlePay('contanti')}
                  className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                >
                  Saldo
                </button>
              </div>
            )}
            {paying && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PURCHASE PACKAGE MODAL
// ============================================================================
function PurchasePackageModal({
  open, onClose, memberId, services, onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  memberId: string;
  services: Service[];
  onSuccess: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register, handleSubmit, reset, watch, setValue, formState: { errors },
  } = useForm<PurchasePackageFormData>({
    resolver: zodResolver(purchasePackageSchema),
    defaultValues: { paid_now: true, payment_method: 'contanti' },
  });

  const selectedServiceId = watch('service_id');
  const selectedService = services.find((s) => s.id === selectedServiceId);
  const paidNow = watch('paid_now');

  useEffect(() => {
    if (selectedService) setValue('total_price', selectedService.unit_price);
  }, [selectedServiceId, selectedService, setValue]);

  useEffect(() => {
    if (open) {
      reset({
        service_id: '',
        total_price: 0,
        paid_now: true,
        payment_method: 'contanti',
        notes: '',
      });
      setError(null);
    }
  }, [open, reset]);

  const grouped = useMemo(() => {
    const map: Record<string, Service[]> = {};
    services.forEach((s) => {
      if (!map[s.category]) map[s.category] = [];
      map[s.category].push(s);
    });
    return map;
  }, [services]);

  const onSubmit = async (data: PurchasePackageFormData) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/soci/${memberId}/pacchetti`, {
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
      title="Acquista pacchetto"
      description="Solo i servizi che includono lift sono mostrati"
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Select label="Pacchetto *" {...register('service_id')} error={errors.service_id?.message}>
          <option value="">— Seleziona pacchetto —</option>
          {(Object.entries(grouped) as [ServiceCategory, Service[]][]).map(([cat, svcs]) => (
            <optgroup key={cat} label={SERVICE_CATEGORY_LABELS[cat]}>
              {svcs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.included_lifts} lift {DISCIPLINE_LABELS[s.discipline]}) — €{Number(s.unit_price).toFixed(2)}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>

        {selectedService && (
          <div className="p-3 rounded bg-accent/5 border border-accent/20 text-xs space-y-1">
            <div>
              <span className="text-text-muted">Disciplina:</span>{' '}
              <span className="text-accent font-medium">{DISCIPLINE_LABELS[selectedService.discipline]}</span>
            </div>
            <div>
              <span className="text-text-muted">Lift inclusi:</span>{' '}
              <span className="text-accent font-medium">{selectedService.included_lifts}</span>
            </div>
          </div>
        )}

        <Input
          label="Prezzo totale €"
          type="number"
          step="0.01"
          min={0}
          {...register('total_price')}
          error={errors.total_price?.message}
          hint="Modificabile per sconti"
        />

        <div className="space-y-3">
          <Checkbox label="Pagato subito" {...register('paid_now')} />
          {paidNow && (
            <Select label="Metodo pagamento" {...register('payment_method')}>
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
              ))}
            </Select>
          )}
          {!paidNow && (
            <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
              Il pacchetto sara creato e i lift saranno disponibili, ma il prezzo
              risultera come debito da incassare.
            </div>
          )}
        </div>

        <Textarea label="Note" {...register('notes')} />

        {error && (
          <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annulla</Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Crea pacchetto
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================================
// CHARGE SERVICE MODAL (singolo non da pacchetto)
// ============================================================================
function ChargeServiceModal({
  open, onClose, memberId, services, onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  memberId: string;
  services: Service[];
  onSuccess: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register, handleSubmit, reset, watch, setValue, formState: { errors },
  } = useForm<ChargeServiceFormData>({
    resolver: zodResolver(chargeServiceSchema),
    defaultValues: { quantity: 1, paid_now: false, payment_method: 'contanti' },
  });

  const selectedServiceId = watch('service_id');
  const selectedService = services.find((s) => s.id === selectedServiceId);
  const qty = watch('quantity');
  const unitPrice = watch('unit_price');
  const paidNow = watch('paid_now');

  useEffect(() => {
    if (selectedService) setValue('unit_price', selectedService.unit_price);
  }, [selectedServiceId, selectedService, setValue]);

  useEffect(() => {
    if (open) {
      reset({
        service_id: '',
        quantity: 1,
        unit_price: 0,
        paid_now: false,
        payment_method: 'contanti',
        notes: '',
      });
      setError(null);
    }
  }, [open, reset]);

  const total = Number(unitPrice || 0) * Number(qty || 1);

  const grouped = useMemo(() => {
    const map: Record<string, Service[]> = {};
    services.forEach((s) => {
      if (!map[s.category]) map[s.category] = [];
      map[s.category].push(s);
    });
    return map;
  }, [services]);

  const onSubmit = async (data: ChargeServiceFormData) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/soci/${memberId}/addebito`, {
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
      title="Addebito singolo"
      description="Per noleggi singoli, lift sciolti, vendite occasionali"
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Select label="Servizio *" {...register('service_id')} error={errors.service_id?.message}>
          <option value="">— Seleziona servizio —</option>
          {(Object.entries(grouped) as [ServiceCategory, Service[]][]).map(([cat, svcs]) => (
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
          <Input label="Quantita" type="number" min={1} {...register('quantity')} />
          <Input label="Prezzo unitario €" type="number" step="0.01" min={0} {...register('unit_price')} />
        </div>

        {total > 0 && (
          <div className="p-3 rounded bg-accent/10 border border-accent/30 flex items-center justify-between">
            <span className="text-sm text-text-muted">Totale</span>
            <span className="font-display text-2xl font-bold text-accent flex items-center gap-1">
              <Euro className="h-5 w-5" />
              {total.toFixed(2)}
            </span>
          </div>
        )}

        <div className="space-y-3">
          <Checkbox label="Pagato subito" {...register('paid_now')} />
          {paidNow ? (
            <Select label="Metodo pagamento" {...register('payment_method')}>
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
              ))}
            </Select>
          ) : (
            <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
              Verra registrato come addebito non pagato (debito).
            </div>
          )}
        </div>

        <Textarea label="Note" {...register('notes')} />

        {error && (
          <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annulla</Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registra
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================================
// PAYMENT MODAL
// ============================================================================
function PaymentModal({
  open, onClose, memberId, suggestedAmount, onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  memberId: string;
  suggestedAmount: number;
  onSuccess: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register, handleSubmit, reset, formState: { errors },
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { payment_method: 'contanti' },
  });

  useEffect(() => {
    if (open) {
      reset({ amount: suggestedAmount || undefined, payment_method: 'contanti', notes: '' });
      setError(null);
    }
  }, [open, suggestedAmount, reset]);

  const onSubmit = async (data: PaymentFormData) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/soci/${memberId}/pagamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
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
    <Modal
      open={open}
      onClose={onClose}
      title="Registra pagamento"
      description={
        suggestedAmount > 0
          ? `Saldo attuale: − € ${suggestedAmount.toFixed(2)} (precompilato)`
          : 'Pagamento generico in entrata'
      }
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Input
          label="Importo €"
          type="number"
          step="0.01"
          min={0.01}
          {...register('amount')}
          error={errors.amount?.message}
        />

        <Select label="Metodo *" {...register('payment_method')} error={errors.payment_method?.message}>
          {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
            <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
          ))}
        </Select>

        <Textarea label="Note" {...register('notes')} />

        {error && (
          <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annulla</Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registra pagamento
          </Button>
        </div>
      </form>
    </Modal>
  );
}
