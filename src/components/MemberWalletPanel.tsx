'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Plus, Loader2, Wallet, Euro, Package as PackageIcon, Receipt,
  AlertCircle, CheckCircle2, Wind, Sparkles, Calendar,
  ChevronDown, ChevronUp, Banknote, Ship,
} from 'lucide-react';

import {
  settleDebtsSchema,
  type SettleDebtsFormData,
} from '@/lib/validation/admin-schemas';
import {
  type Service, type Package, type Movement, type MemberWallet,
  type LiftBalance, type ServiceCategory, type PaymentMethod, type LiftDiscipline,
  type ActiveSubscription, type OpenDebt,
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
  active_subscriptions: ActiveSubscription[];
  open_debts: OpenDebt[];
}

type ModalMode = null | 'sell' | 'settle';

export default function MemberWalletPanel({ memberId, services }: Props) {
  const [data, setData] = useState<WalletData>({
    wallet: null, lift_balances: [], packages: [], movements: [],
    active_subscriptions: [], open_debts: [],
  });
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [showAllMovements, setShowAllMovements] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/soci/${memberId}/wallet`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, [memberId]); // eslint-disable-line react-hooks/exhaustive-deps

  const outstanding = Number(data.wallet?.total_outstanding || 0);
  const debtsCount = data.wallet?.open_debts_count || 0;
  const activePackages = data.packages.filter((p) => !p.is_exhausted && !p.is_subscription);
  const exhaustedPackages = data.packages.filter((p) => p.is_exhausted && !p.is_subscription);
  const visibleMovements = showAllMovements ? data.movements : data.movements.slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
        {/* Header con azioni */}
        <div className="p-5 border-b border-border">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h2 className="font-display font-semibold text-lg tracking-tight flex items-center gap-2">
              <Wallet className="h-5 w-5 text-accent" />
              Wallet del socio
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setModalMode('sell')}>
                <PackageIcon className="h-3.5 w-3.5 mr-1.5" />
                Registra acquisto
              </Button>
              {outstanding > 0 && (
                <Button size="sm" onClick={() => setModalMode('settle')}>
                  <Banknote className="h-3.5 w-3.5 mr-1.5" />
                  Salda debiti
                </Button>
              )}
            </div>
          </div>

          {/* KPI singolo: solo da incassare */}
          <div className={cn(
            'p-4 rounded-md border',
            outstanding > 0
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-bg-elevated border-border'
          )}>
            <div className="flex items-center justify-between">
              <div>
                <div className={cn(
                  'text-[10px] uppercase tracking-widest',
                  outstanding > 0 ? 'text-amber-400' : 'text-text-dim'
                )}>
                  {outstanding > 0 ? 'Da incassare' : 'Nessun debito aperto'}
                </div>
                <div className={cn(
                  'font-display text-3xl font-bold mt-1',
                  outstanding > 0 ? 'text-amber-400' : 'text-text'
                )}>
                  € {outstanding.toFixed(2)}
                </div>
                {debtsCount > 0 && (
                  <div className="text-xs text-text-muted mt-1">
                    {debtsCount} {debtsCount === 1 ? 'debito aperto' : 'debiti aperti'}
                  </div>
                )}
              </div>
              {outstanding > 0 ? (
                <AlertCircle className="h-8 w-8 text-amber-400 opacity-50" />
              ) : (
                <CheckCircle2 className="h-8 w-8 text-emerald-400 opacity-50" />
              )}
            </div>
          </div>
        </div>

        {/* Abbonamenti stagionali attivi */}
        {data.active_subscriptions.length > 0 && (
          <div className="p-5 border-b border-border">
            <h3 className="text-[10px] uppercase tracking-widest text-text-dim font-medium mb-3 flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-accent" />
              Abbonamenti stagionali attivi
            </h3>
            <div className="space-y-2">
              {data.active_subscriptions.map((s) => (
                <div key={s.package_id} className="p-3 rounded bg-accent/5 border border-accent/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Sparkles className="h-3.5 w-3.5 text-accent shrink-0" />
                        <span className="font-medium text-sm text-text">{s.service_name_snapshot}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent">
                          {DISCIPLINE_LABELS[s.discipline]} ∞
                        </span>
                      </div>
                      <div className="text-[10px] text-text-muted mt-1.5 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Valido dal {formatDate(s.valid_from)} al {formatDate(s.valid_until)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={cn(
                        'text-xs font-medium',
                        s.days_remaining < 14 ? 'text-amber-400' : 'text-accent'
                      )}>
                        {s.days_remaining} {s.days_remaining === 1 ? 'giorno' : 'giorni'}
                      </div>
                      <div className="text-[10px] text-text-dim">rimanenti</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lift residui per disciplina */}
        {data.lift_balances.length > 0 && data.lift_balances.some((b) => b.lifts_remaining > 0) && (
          <div className="p-5 border-b border-border">
            <h3 className="text-[10px] uppercase tracking-widest text-text-dim font-medium mb-3 flex items-center gap-2">
              <Wind className="h-3 w-3" />
              Lift residui (pacchetti)
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {data.lift_balances.filter((b) => b.lifts_total > 0).map((b) => {
                const isEmpty = b.lifts_remaining === 0;
                return (
                  <div key={b.discipline} className={cn(
                    'p-3 rounded border',
                    isEmpty
                      ? 'bg-bg-elevated border-border opacity-50'
                      : 'bg-emerald-500/5 border-emerald-500/30'
                  )}>
                    <div className="text-[10px] uppercase tracking-widest text-text-dim">
                      {DISCIPLINE_LABELS[b.discipline]}
                    </div>
                    <div className="font-display text-2xl font-bold mt-1">
                      <span className={cn(isEmpty ? 'text-text-dim' : 'text-emerald-400')}>
                        {b.lifts_remaining}
                      </span>
                      <span className="text-text-dim text-base"> / {b.lifts_total}</span>
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
                        <div className="font-display font-bold text-accent">{remaining}</div>
                        <div className="text-[10px] text-text-dim">su {p.lifts_total}</div>
                      </div>
                    </div>
                    <div className="h-1 bg-bg rounded overflow-hidden">
                      <div className="h-full bg-accent transition-all" style={{ width: `${100 - pctUsed}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Debiti aperti dettagliati */}
        {data.open_debts.length > 0 && (
          <div className="p-5 border-b border-border">
            <h3 className="text-[10px] uppercase tracking-widest text-amber-400 font-medium mb-3 flex items-center gap-2">
              <AlertCircle className="h-3 w-3" />
              Debiti aperti — {data.open_debts.length}
            </h3>
            <div className="space-y-1.5">
              {data.open_debts.map((d) => (
                <div key={d.movement_id} className="p-2.5 rounded bg-amber-500/5 border border-amber-500/20">
                  <div className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="text-text">{d.description}</div>
                      <div className="text-[10px] text-text-dim mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>{formatDate(d.movement_date)}</span>
                        {d.outing_id && d.boat_name && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <Ship className="h-3 w-3" />
                              {d.boat_name}
                              {d.outing_date && ` (${formatDate(d.outing_date)})`}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="font-display font-semibold text-amber-400 flex items-center gap-1 shrink-0">
                      <Euro className="h-3 w-3" />
                      {Number(d.amount_due).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Storico movimenti */}
        <div className="p-5">
          <h3 className="text-[10px] uppercase tracking-widest text-text-dim font-medium mb-3 flex items-center gap-2">
            <Receipt className="h-3 w-3" />
            Storico movimenti
          </h3>

          {loading ? (
            <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-text-muted" /></div>
          ) : data.movements.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-6">
              Nessun movimento ancora.
            </p>
          ) : (
            <>
              <div className="divide-y divide-border">
                {visibleMovements.map((m) => (
                  <MovementRow key={m.id} movement={m} />
                ))}
              </div>
              {data.movements.length > 8 && (
                <button
                  onClick={() => setShowAllMovements(!showAllMovements)}
                  className="w-full mt-3 p-2 text-xs text-text-muted hover:text-text border-t border-border flex items-center justify-center gap-1"
                >
                  {showAllMovements
                    ? <>Mostra solo gli ultimi 8 <ChevronUp className="h-3 w-3" /></>
                    : <>Mostra tutti i {data.movements.length} movimenti <ChevronDown className="h-3 w-3" /></>
                  }
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
                    {p.service_name_snapshot} · {p.lifts_total}/{p.lifts_total} usati · {formatDate(p.created_at)}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>

      <SellModal
        open={modalMode === 'sell'}
        onClose={() => setModalMode(null)}
        memberId={memberId}
        services={services.filter((s) => s.is_active)}
        onSuccess={load}
      />
      <SettleDebtsModal
        open={modalMode === 'settle'}
        onClose={() => setModalMode(null)}
        memberId={memberId}
        debts={data.open_debts}
        onSuccess={load}
      />
    </div>
  );
}

// ============================================================================
// MOVEMENT ROW (read-only nello storico)
// ============================================================================
function MovementRow({ movement }: { movement: Movement }) {
  const amount = Number(movement.amount);
  const isCredit = amount > 0;
  const isDebit = amount < 0;
  const isLiftConsume = movement.movement_type === 'consumo_lift';

  return (
    <div className="py-3 flex items-start gap-3">
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
        isCredit ? 'bg-emerald-500/10 text-emerald-400' :
        isDebit ? 'bg-amber-500/10 text-amber-400' :
        'bg-bg-elevated text-text-muted'
      )}>
        {isCredit ? <Banknote className="h-4 w-4" /> :
         isDebit ? <Receipt className="h-4 w-4" /> :
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
              {isDebit && !movement.paid && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                  non pagato
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
            {amount !== 0 && (
              <div className={cn(
                'font-display font-semibold flex items-center gap-1',
                isCredit ? 'text-emerald-400' : 'text-amber-400'
              )}>
                <Euro className="h-3 w-3" />
                {isCredit ? '+' : '−'}
                {Math.abs(amount).toFixed(2)}
              </div>
            )}
            {isLiftConsume && Number(movement.lift_delta) === -1 && (
              <div className="text-xs text-text-muted">
                −1 lift {movement.lift_discipline}
              </div>
            )}
            {isLiftConsume && Number(movement.lift_delta) === 0 && (
              <div className="text-[10px] text-accent">coperto</div>
            )}
            {Number(movement.lift_delta) > 0 && (
              <div className="text-xs text-emerald-400">
                +{movement.lift_delta} lift {movement.lift_discipline}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SELL MODAL — UNIFIED: pacchetti, abbonamenti e vendite una tantum
// ============================================================================
function SellModal({
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
  const [seasonDefaults, setSeasonDefaults] = useState<{ valid_from: string; valid_until: string } | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [totalPrice, setTotalPrice] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [paidNow, setPaidNow] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('contanti');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');

  const selectedService = services.find((s) => s.id === selectedServiceId);

  // Categorizzazione automatica: il servizio crea un pacchetto vero o e' una vendita una tantum?
  const kind: 'package' | 'subscription' | 'oneoff' | null = !selectedService
    ? null
    : selectedService.is_subscription
      ? 'subscription'
      : selectedService.included_lifts > 1
        ? 'package'
        : 'oneoff';

  useEffect(() => {
    if (open) {
      setSelectedServiceId('');
      setTotalPrice(0);
      setQuantity(1);
      setPaidNow(true);
      setPaymentMethod('contanti');
      setValidFrom('');
      setValidUntil('');
      setNotes('');
      setSearch('');
      setError(null);
      // Carica date stagione di default
      fetch('/api/settings/stagione')
        .then((r) => r.json())
        .then((season: { start_month_day: string; end_month_day: string }) => {
          const today = new Date();
          const year = today.getFullYear();
          const seasonStart = new Date(`${year}-${season.start_month_day}T00:00:00`);
          const seasonEnd = new Date(`${year}-${season.end_month_day}T00:00:00`);
          let vf: string, vu: string;
          if (today > seasonEnd) {
            vf = `${year + 1}-${season.start_month_day}`;
            vu = `${year + 1}-${season.end_month_day}`;
          } else {
            vf = today < seasonStart ? `${year}-${season.start_month_day}` : today.toISOString().slice(0, 10);
            vu = `${year}-${season.end_month_day}`;
          }
          setSeasonDefaults({ valid_from: vf, valid_until: vu });
        })
        .catch(() => null);
    }
  }, [open]);

  // Quando si seleziona un servizio, precarica prezzo e (se abbonamento) date
  useEffect(() => {
    if (!selectedService) return;
    setTotalPrice(Number(selectedService.unit_price));
    setQuantity(1);
    if (selectedService.is_subscription && seasonDefaults) {
      setValidFrom(seasonDefaults.valid_from);
      setValidUntil(seasonDefaults.valid_until);
    }
  }, [selectedServiceId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filtra servizi per ricerca
  const filteredServices = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return services;
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        SERVICE_CATEGORY_LABELS[s.category].toLowerCase().includes(q)
    );
  }, [services, search]);

  // Raggruppamento per categoria
  const grouped = useMemo(() => {
    const map: Record<string, Service[]> = {};
    filteredServices.forEach((s) => {
      if (!map[s.category]) map[s.category] = [];
      map[s.category].push(s);
    });
    return map;
  }, [filteredServices]);

  const handleSubmit = async () => {
    if (!selectedService) return;
    setSubmitting(true);
    setError(null);
    try {
      let res: Response;
      if (kind === 'package' || kind === 'subscription') {
        // Crea un pacchetto vero (lift scalano in automatico)
        res = await fetch(`/api/soci/${memberId}/pacchetti`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: selectedService.id,
            total_price: totalPrice,
            paid_now: paidNow,
            payment_method: paidNow ? paymentMethod : null,
            valid_from: kind === 'subscription' ? validFrom : '',
            valid_until: kind === 'subscription' ? validUntil : '',
            notes,
          }),
        });
      } else {
        // Vendita una tantum (lift singolo, lezione singola, noleggio sciolto, ecc.)
        res = await fetch(`/api/soci/${memberId}/addebito`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: selectedService.id,
            quantity,
            unit_price: totalPrice / quantity,
            paid_now: paidNow,
            payment_method: paidNow ? paymentMethod : null,
            notes,
          }),
        });
      }
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
      title="Registra acquisto"
      description="Pacchetti, abbonamenti, lift singoli, noleggi, vendite extra"
      size="lg"
    >
      <div className="space-y-5">
        {/* STEP 1: scelta servizio */}
        {!selectedService ? (
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Cerca o seleziona dal listino *
            </label>
            <input
              type="text"
              placeholder="Cerca per nome o categoria..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2.5 mb-3 rounded-md border border-border bg-bg-elevated text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              autoFocus
            />
            <div className="max-h-96 overflow-y-auto bg-bg-elevated border border-border rounded">
              {Object.keys(grouped).length === 0 ? (
                <p className="p-3 text-sm text-text-muted text-center">Nessun servizio trovato.</p>
              ) : (
                Object.entries(grouped).map(([cat, svcs]) => (
                  <div key={cat}>
                    <div className="px-3 py-1.5 bg-bg/50 text-[10px] uppercase tracking-widest text-text-dim font-medium border-b border-border">
                      {SERVICE_CATEGORY_LABELS[cat as ServiceCategory]}
                    </div>
                    {svcs.map((s) => {
                      const isSub = s.is_subscription;
                      const isPkg = !isSub && s.included_lifts > 1;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedServiceId(s.id)}
                          className="w-full p-3 text-left hover:bg-bg-surface border-b border-border last:border-b-0"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm text-text font-medium flex items-center gap-2 flex-wrap">
                                <span>{s.name}</span>
                                {isSub && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent flex items-center gap-1">
                                    <Sparkles className="h-2.5 w-2.5" />
                                    abbonamento
                                  </span>
                                )}
                                {isPkg && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                                    {s.included_lifts} lift
                                  </span>
                                )}
                                {!isSub && !isPkg && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated text-text-muted">
                                    una tantum
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-text-dim mt-0.5">
                                {DISCIPLINE_LABELS[s.discipline]}
                                {isSub && ' · lift illimitati nella stagione'}
                                {isPkg && ' · scalati uno a uno alle uscite'}
                                {!isSub && !isPkg && ' · solo addebito, niente da scalare'}
                              </div>
                            </div>
                            <div className="font-display font-semibold text-text shrink-0">
                              € {Number(s.unit_price).toFixed(2)}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <>
            {/* STEP 2: parametri */}
            <div className={cn(
              'p-3 rounded border flex items-start gap-3',
              kind === 'subscription'
                ? 'bg-accent/5 border-accent/30'
                : kind === 'package'
                  ? 'bg-emerald-500/5 border-emerald-500/30'
                  : 'bg-bg-elevated border-border'
            )}>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm text-text">{selectedService.name}</div>
                <div className="text-[10px] text-text-muted mt-0.5">
                  {kind === 'subscription' && (
                    <>
                      <Sparkles className="inline h-3 w-3 text-accent mr-1" />
                      Abbonamento stagionale ({DISCIPLINE_LABELS[selectedService.discipline]}) — lift illimitati
                    </>
                  )}
                  {kind === 'package' && (
                    <>
                      Pacchetto {selectedService.included_lifts} lift {DISCIPLINE_LABELS[selectedService.discipline]}
                      — si scalano automaticamente
                    </>
                  )}
                  {kind === 'oneoff' && (
                    <>Vendita una tantum — solo addebito contabile</>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedServiceId('')}
                className="text-xs text-accent hover:underline shrink-0"
              >
                Cambia
              </button>
            </div>

            {/* Campo quantità solo per le una tantum */}
            {kind === 'oneoff' && (
              <Input
                label="Quantità"
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                hint={`Verra' addebitato ${quantity} × € ${(totalPrice / quantity).toFixed(2)} = € ${(totalPrice).toFixed(2)}`}
              />
            )}

            {kind === 'subscription' && (
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Valido dal *"
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                />
                <Input
                  label="Valido fino al *"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
            )}

            <Input
              label="Prezzo totale €"
              type="number"
              step="0.01"
              min={0}
              value={totalPrice}
              onChange={(e) => setTotalPrice(Number(e.target.value) || 0)}
              hint="Modificabile per sconti o personalizzazioni"
            />

            <div className="space-y-3">
              <Checkbox
                label="Pagato subito"
                checked={paidNow}
                onChange={(e) => setPaidNow(e.target.checked)}
              />
              {paidNow ? (
                <Select
                  label="Metodo pagamento"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                >
                  {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                    <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
                  ))}
                </Select>
              ) : (
                <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
                  {kind === 'subscription'
                    ? 'L\'abbonamento sarà attivo, ma il prezzo risulterà come debito da incassare.'
                    : kind === 'package'
                      ? 'Il pacchetto sarà creato e i lift saranno disponibili, ma il prezzo risulterà come debito da incassare.'
                      : 'L\'acquisto verrà registrato come debito non pagato.'
                  }
                </div>
              )}
            </div>

            <Textarea label="Note" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </>
        )}

        {error && (
          <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-border">
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !selectedService}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {kind === 'subscription' && 'Attiva abbonamento'}
            {kind === 'package' && 'Crea pacchetto'}
            {kind === 'oneoff' && `Registra acquisto (€ ${totalPrice.toFixed(2)})`}
            {!selectedService && 'Seleziona un servizio'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// SETTLE DEBTS MODAL — saldo selettivo
// ============================================================================
function SettleDebtsModal({
  open, onClose, memberId, debts, onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  memberId: string;
  debts: OpenDebt[];
  onSuccess: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const {
    register, handleSubmit, reset,
  } = useForm<SettleDebtsFormData>({
    resolver: zodResolver(settleDebtsSchema),
    defaultValues: { payment_method: 'contanti' },
  });

  // Tutti selezionati di default all'apertura
  useEffect(() => {
    if (open) {
      const map: Record<string, boolean> = {};
      debts.forEach((d) => { map[d.movement_id] = true; });
      setSelected(map);
      reset({ payment_method: 'contanti', notes: '', movement_ids: debts.map((d) => d.movement_id) });
      setError(null);
    }
  }, [open, debts, reset]);

  const selectedIds = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
  const total = debts
    .filter((d) => selected[d.movement_id])
    .reduce((acc, d) => acc + Number(d.amount_due), 0);

  const onSubmit = async (data: SettleDebtsFormData) => {
    if (selectedIds.length === 0) {
      setError('Seleziona almeno un debito');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/soci/${memberId}/salda-debiti`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          movement_ids: selectedIds,
          payment_method: data.payment_method,
          notes: data.notes,
        }),
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
    <Modal open={open} onClose={onClose} title="Salda debiti" description={`${debts.length} debiti aperti`} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {debts.map((d) => (
            <label
              key={d.movement_id}
              className={cn(
                'flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors',
                selected[d.movement_id]
                  ? 'bg-accent/5 border-accent/30'
                  : 'bg-bg-elevated border-border hover:border-text-muted'
              )}
            >
              <input
                type="checkbox"
                checked={selected[d.movement_id] || false}
                onChange={(e) => setSelected((s) => ({ ...s, [d.movement_id]: e.target.checked }))}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm text-text">{d.description}</div>
                <div className="text-[10px] text-text-dim mt-0.5">
                  {formatDate(d.movement_date)}
                  {d.boat_name && ` · ${d.boat_name}`}
                  {d.outing_date && ` (${formatDate(d.outing_date)})`}
                </div>
              </div>
              <div className="font-display font-semibold text-amber-400 flex items-center gap-1 shrink-0">
                <Euro className="h-3 w-3" />
                {Number(d.amount_due).toFixed(2)}
              </div>
            </label>
          ))}
        </div>

        <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
          <span className="text-sm text-text">
            {selectedIds.length} {selectedIds.length === 1 ? 'debito selezionato' : 'debiti selezionati'}
          </span>
          <span className="font-display text-2xl font-bold text-emerald-400 flex items-center gap-1">
            <Euro className="h-5 w-5" />
            {total.toFixed(2)}
          </span>
        </div>

        <Select label="Metodo pagamento *" {...register('payment_method')}>
          {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
            <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
          ))}
        </Select>

        <Textarea label="Note pagamento" {...register('notes')} />

        {error && (
          <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-sm text-red-400">{error}</div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annulla</Button>
          <Button type="submit" disabled={submitting || selectedIds.length === 0}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Incassa € {total.toFixed(2)}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
