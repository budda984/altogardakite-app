'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wallet, Wind, Sparkles, Loader2, Plus, AlertCircle,
  Calendar, GraduationCap, History, Package as PackageIcon,
} from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { cn, formatDate } from '@/lib/utils';
import {
  type LiftDiscipline, type Service,
  DISCIPLINE_LABELS, SERVICE_CATEGORY_LABELS,
} from '@/lib/types';

// ============================================================================
// MAIN PANEL
// ============================================================================

interface WalletData {
  active_subscriptions: ActiveSubscription[];
  lift_balances: LiftBalance[];
  active_packages: ActivePackage[];
  recent_movements: Movement[];
}

interface ActiveSubscription {
  package_id: string;
  service_name_snapshot: string;
  discipline: LiftDiscipline;
  valid_from: string;
  valid_until: string;
  days_remaining: number;
}

interface LiftBalance {
  discipline: LiftDiscipline;
  lifts_remaining: number;
}

interface ActivePackage {
  id: string;
  service_name_snapshot: string;
  discipline: LiftDiscipline;
  lifts_total: number;
  lifts_used: number;
  lifts_remaining: number;
  is_subscription: boolean;
  created_at: string;
}

interface Movement {
  id: string;
  movement_date: string;
  movement_type: string;
  description: string;
  lift_delta: number;
  lift_discipline: LiftDiscipline | null;
}

type ModalMode = null | 'add_package';

export default function MemberWalletPanel({ memberId }: { memberId: string }) {
  const [data, setData] = useState<WalletData | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [walletRes, servicesRes] = await Promise.all([
        fetch(`/api/soci/${memberId}/wallet`),
        fetch('/api/servizi'),
      ]);
      if (!walletRes.ok) throw new Error('Errore caricamento wallet');
      if (!servicesRes.ok) throw new Error('Errore caricamento servizi');
      const walletData = await walletRes.json();
      const servicesData = await servicesRes.json();
      setData(walletData);
      setServices(servicesData.services || servicesData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore');
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="bg-bg-surface border border-border rounded-lg p-6">
        <Loader2 className="h-5 w-5 animate-spin mx-auto text-text-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="bg-bg-surface border border-border rounded-lg p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-display font-semibold">Wallet del socio</h2>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setModalMode('add_package')}>
          <PackageIcon className="h-3.5 w-3.5 mr-1.5" />
          Aggiungi pacchetto
        </Button>
      </div>

      {/* Abbonamenti attivi */}
      {data.active_subscriptions.length > 0 && (
        <section className="mb-6">
          <h3 className="text-xs uppercase tracking-widest text-text-dim mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            Abbonamenti attivi
          </h3>
          <div className="space-y-2">
            {data.active_subscriptions.map((s) => (
              <div
                key={s.package_id}
                className="p-3 rounded border border-accent/30 bg-accent/5"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-medium text-sm text-text">
                      {s.service_name_snapshot}
                    </div>
                    <div className="text-xs text-text-muted mt-0.5">
                      {DISCIPLINE_LABELS[s.discipline]} · {formatDate(s.valid_from)} → {formatDate(s.valid_until)}
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-accent/20 text-accent">
                    {s.days_remaining} giorni residui
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Lift residui per disciplina */}
      {data.lift_balances.length > 0 && (
        <section className="mb-6">
          <h3 className="text-xs uppercase tracking-widest text-text-dim mb-2 flex items-center gap-1.5">
            <Wind className="h-3 w-3" />
            Lift / Lezioni residui
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {data.lift_balances.map((b) => (
              <div
                key={b.discipline}
                className={cn(
                  'p-3 rounded border',
                  b.lifts_remaining > 0
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-border bg-bg-elevated/30'
                )}
              >
                <div className="text-[10px] uppercase tracking-wide text-text-dim mb-1 flex items-center gap-1">
                  {b.discipline === 'corso' ? <GraduationCap className="h-2.5 w-2.5" /> : <Wind className="h-2.5 w-2.5" />}
                  {DISCIPLINE_LABELS[b.discipline]}
                </div>
                <div className={cn(
                  'font-display text-2xl font-bold',
                  b.lifts_remaining > 0 ? 'text-emerald-400' : 'text-text-dim'
                )}>
                  {b.lifts_remaining}
                </div>
                <div className="text-[10px] text-text-dim mt-0.5">
                  {b.discipline === 'corso' ? 'lezioni' : 'lift'} disponibili
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pacchetti attivi */}
      {data.active_packages.length > 0 && (
        <section className="mb-6">
          <h3 className="text-xs uppercase tracking-widest text-text-dim mb-2 flex items-center gap-1.5">
            <PackageIcon className="h-3 w-3" />
            Pacchetti attivi
          </h3>
          <div className="space-y-2">
            {data.active_packages.map((p) => (
              <PackageRow key={p.id} pkg={p} />
            ))}
          </div>
        </section>
      )}

      {/* Storico recente */}
      {data.recent_movements.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-widest text-text-dim mb-2 flex items-center gap-1.5">
            <History className="h-3 w-3" />
            Storico recente
          </h3>
          <div className="space-y-1">
            {data.recent_movements.slice(0, 10).map((m) => (
              <MovementRow key={m.id} movement={m} />
            ))}
          </div>
        </section>
      )}

      {/* Stato vuoto */}
      {data.active_subscriptions.length === 0 &&
       data.lift_balances.length === 0 &&
       data.active_packages.length === 0 && (
        <div className="text-center py-6 text-sm text-text-dim">
          <PackageIcon className="h-6 w-6 mx-auto mb-2" />
          Nessun pacchetto o abbonamento attivo.
          <br />
          <span className="text-xs">
            Click su <strong>Aggiungi pacchetto</strong> per assegnarne uno al socio.
          </span>
        </div>
      )}

      {/* Modale aggiungi pacchetto */}
      <AddPackageModal
        open={modalMode === 'add_package'}
        onClose={() => setModalMode(null)}
        memberId={memberId}
        services={services.filter((s) => s.is_active)}
        onSuccess={load}
      />
    </div>
  );
}

// ============================================================================
// PACKAGE ROW
// ============================================================================
function PackageRow({ pkg }: { pkg: ActivePackage }) {
  const usedPct = pkg.lifts_total > 0 ? (pkg.lifts_used / pkg.lifts_total) * 100 : 0;

  return (
    <div className="p-3 rounded border border-border bg-bg-elevated/40">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="font-medium text-sm text-text">
            {pkg.service_name_snapshot}
          </div>
          <div className="text-[10px] text-text-dim mt-0.5">
            {DISCIPLINE_LABELS[pkg.discipline]} · creato il {formatDate(pkg.created_at)}
          </div>
        </div>
        <span className="text-xs text-text-muted shrink-0">
          {pkg.lifts_used} / {pkg.lifts_total}
        </span>
      </div>
      <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
        <div
          className="h-full bg-accent transition-all"
          style={{ width: `${usedPct}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// MOVEMENT ROW (no prezzi, solo lift)
// ============================================================================
function MovementRow({ movement }: { movement: Movement }) {
  const lift = Number(movement.lift_delta);
  const isPositive = lift > 0;
  const isNegative = lift < 0;

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-bg-elevated/40 text-xs">
      <div className="text-text-dim font-mono shrink-0 w-20">
        {formatDate(movement.movement_date)}
      </div>
      <div className="flex-1 truncate text-text-muted">
        {movement.description}
      </div>
      {lift !== 0 && (
        <div className={cn(
          'shrink-0 font-mono font-semibold',
          isPositive ? 'text-emerald-400' :
          isNegative ? 'text-amber-400' : 'text-text-dim'
        )}>
          {isPositive && '+'}{lift} {movement.lift_discipline ? DISCIPLINE_LABELS[movement.lift_discipline] : ''}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ADD PACKAGE MODAL (no price, no paid)
// ============================================================================
function AddPackageModal({
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
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');

  const selectedService = services.find((s) => s.id === selectedServiceId);

  // Solo servizi che danno lift o sono abbonamento
  const eligibleServices = useMemo(
    () => services.filter((s) => s.is_subscription || s.included_lifts > 0),
    [services]
  );

  const kind: 'package' | 'subscription' | null = !selectedService
    ? null
    : selectedService.is_subscription
      ? 'subscription'
      : 'package';

  useEffect(() => {
    if (open) {
      setSelectedServiceId('');
      setValidFrom('');
      setValidUntil('');
      setNotes('');
      setSearch('');
      setError(null);
      // Carica date stagione di default per abbonamenti
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

  useEffect(() => {
    if (!selectedService) return;
    if (selectedService.is_subscription && seasonDefaults) {
      setValidFrom(seasonDefaults.valid_from);
      setValidUntil(seasonDefaults.valid_until);
    }
  }, [selectedServiceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredServices = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return eligibleServices;
    return eligibleServices.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        SERVICE_CATEGORY_LABELS[s.category].toLowerCase().includes(q)
    );
  }, [eligibleServices, search]);

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
      const res = await fetch(`/api/soci/${memberId}/pacchetti`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: selectedService.id,
          total_price: 0,         // niente prezzo
          paid_now: true,          // sempre marcato pagato (nessun debito viene generato)
          payment_method: null,
          valid_from: kind === 'subscription' ? validFrom : '',
          valid_until: kind === 'subscription' ? validUntil : '',
          notes,
        }),
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
      title="Aggiungi pacchetto / abbonamento"
      description="Assegna lift o un abbonamento al socio"
      size="lg"
    >
      <div className="space-y-5">
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
                <p className="p-3 text-sm text-text-muted text-center">
                  Nessun pacchetto disponibile.
                </p>
              ) : (
                Object.entries(grouped).map(([cat, svcs]) => (
                  <div key={cat}>
                    <div className="px-3 py-1.5 bg-bg/50 text-[10px] uppercase tracking-widest text-text-dim font-medium border-b border-border">
                      {SERVICE_CATEGORY_LABELS[cat as keyof typeof SERVICE_CATEGORY_LABELS]}
                    </div>
                    {svcs.map((s) => {
                      const isSub = s.is_subscription;
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
                                {!isSub && s.included_lifts > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                                    {s.included_lifts} {s.discipline === 'corso' ? 'lezioni' : 'lift'}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-text-dim mt-0.5">
                                {DISCIPLINE_LABELS[s.discipline]}
                                {isSub && ' · lift illimitati nella stagione'}
                                {!isSub && s.included_lifts > 0 && ' · scalati uno a uno alle uscite'}
                              </div>
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
            <div className={cn(
              'p-3 rounded border flex items-start gap-3',
              kind === 'subscription'
                ? 'bg-accent/5 border-accent/30'
                : 'bg-emerald-500/5 border-emerald-500/30'
            )}>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm text-text">{selectedService.name}</div>
                <div className="text-[10px] text-text-muted mt-0.5">
                  {kind === 'subscription' ? (
                    <>
                      <Sparkles className="inline h-3 w-3 text-accent mr-1" />
                      Abbonamento stagionale ({DISCIPLINE_LABELS[selectedService.discipline]}) — lift illimitati
                    </>
                  ) : (
                    <>
                      Pacchetto {selectedService.included_lifts} {selectedService.discipline === 'corso' ? 'lezioni' : 'lift'} {DISCIPLINE_LABELS[selectedService.discipline]}
                    </>
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
            {!selectedService && 'Seleziona un servizio'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
