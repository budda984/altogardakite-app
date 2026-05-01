'use client';

import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Search, AlertCircle, Check, Wind, Euro } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import {
  planningParticipantSchema, type PlanningParticipantFormData,
} from '@/lib/validation/admin-schemas';
import type {
  Member, Service, Package, MemberWallet, LiftBalance,
  LiftDiscipline, PaymentMethod,
} from '@/lib/types';
import { DISCIPLINE_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/types';
import { cn } from '@/lib/utils';

interface OutingMin {
  id: string;
  discipline: LiftDiscipline | null;
  boat: { name: string } | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  outing: OutingMin;
  members: Pick<Member, 'id' | 'first_name' | 'last_name' | 'membership_number'>[];
  services: Service[];
  onSuccess: () => void;
}

export default function AddParticipantModal({
  open, onClose, outing, members, services, onSuccess,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [walletData, setWalletData] = useState<{
    wallet: MemberWallet | null;
    lift_balances: LiftBalance[];
    packages: Package[];
  } | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);

  const discipline = outing.discipline || 'kite';

  const {
    register, handleSubmit, reset, watch, setValue, formState: { errors },
  } = useForm<PlanningParticipantFormData>({
    resolver: zodResolver(planningParticipantSchema),
    defaultValues: {
      participation_type: 'lift',
      rental_type: 'nessuno',
      billing_mode: 'no_charge',
    },
  });

  const memberId = watch('member_id');
  const billingMode = watch('billing_mode');
  const packageId = watch('package_id');

  // Filtra soci per ricerca
  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return members.slice(0, 20);
    const q = memberSearch.toLowerCase();
    return members.filter((m) =>
      `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
      String(m.membership_number).includes(q)
    ).slice(0, 20);
  }, [members, memberSearch]);

  // Carica wallet quando cambia socio
  useEffect(() => {
    if (!memberId) {
      setWalletData(null);
      return;
    }
    setWalletLoading(true);
    fetch(`/api/soci/${memberId}/wallet`)
      .then((r) => r.json())
      .then((data) => setWalletData(data))
      .catch(() => setWalletData(null))
      .finally(() => setWalletLoading(false));
  }, [memberId]);

  // Calcola pacchetti compatibili con la disciplina dell'uscita
  const availablePackages = useMemo(() => {
    if (!walletData) return [];
    return walletData.packages.filter(
      (p) => !p.is_exhausted && p.discipline === discipline
    );
  }, [walletData, discipline]);

  // Lift residui per la disciplina dell'uscita
  const liftBalance = walletData?.lift_balances.find((b) => b.discipline === discipline);

  // Suggerimento: se ha lift, suggerisci consume_package; altrimenti charge_unpaid
  useEffect(() => {
    if (!walletData) return;
    if (availablePackages.length > 0) {
      setValue('billing_mode', 'consume_package');
      // Se non c'e ancora un package_id selezionato, usa il primo (FIFO)
      if (!packageId && availablePackages[0]) {
        setValue('package_id', availablePackages[0].id);
      }
    } else {
      setValue('billing_mode', 'charge_unpaid');
      // Suggerisci prezzo lift singolo della disciplina
      const liftService = services.find(
        (s) => s.discipline === discipline && s.included_lifts === 1 && s.category === 'lift_singolo'
      );
      if (liftService) {
        setValue('charge_amount', liftService.unit_price);
      }
    }
  }, [walletData, availablePackages, services, discipline, packageId, setValue]);

  useEffect(() => {
    if (open) {
      reset({
        member_id: undefined,
        participation_type: 'lift',
        rental_type: 'nessuno',
        billing_mode: 'no_charge',
        package_id: null,
        charge_amount: null,
        payment_method: 'contanti',
        notes: '',
      });
      setMemberSearch('');
      setWalletData(null);
      setError(null);
    }
  }, [open, reset]);

  const onSubmit = async (data: PlanningParticipantFormData) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/planning/uscita/${outing.id}/partecipanti`, {
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

  const memberSelected = memberId ? members.find((m) => m.id === memberId) : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Aggiungi partecipante a ${outing.boat?.name || 'uscita'}`}
      description={`Disciplina dell'uscita: ${DISCIPLINE_LABELS[discipline]}`}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Step 1: ricerca socio */}
        {!memberId ? (
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Cerca e seleziona socio *
            </label>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-dim" />
              <input
                placeholder="Cognome, nome o numero tessera"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                autoFocus
                className="w-full pl-10 pr-4 py-2.5 rounded-md border border-border bg-bg-elevated text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              />
            </div>
            <div className="max-h-72 overflow-y-auto bg-bg-elevated border border-border rounded divide-y divide-border">
              {filteredMembers.length === 0 ? (
                <p className="p-4 text-sm text-text-muted text-center">Nessun socio trovato.</p>
              ) : (
                filteredMembers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setValue('member_id', m.id)}
                    className="w-full p-3 text-left hover:bg-bg-surface text-sm flex items-center justify-between"
                  >
                    <span className="text-text">
                      {m.last_name} {m.first_name}
                    </span>
                    <span className="text-xs text-text-dim">#{m.membership_number}</span>
                  </button>
                ))
              )}
            </div>
            {errors.member_id && (
              <p className="text-xs text-red-400 mt-1">{errors.member_id.message}</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header con socio selezionato */}
            <div className="flex items-center justify-between p-3 bg-accent/5 border border-accent/30 rounded">
              <div>
                <div className="font-medium text-text">
                  {memberSelected?.last_name} {memberSelected?.first_name}
                </div>
                <div className="text-xs text-text-muted">Tessera #{memberSelected?.membership_number}</div>
              </div>
              <button
                type="button"
                onClick={() => setValue('member_id', '')}
                className="text-xs text-accent hover:underline"
              >
                Cambia socio
              </button>
            </div>

            {/* Stato wallet del socio */}
            {walletLoading ? (
              <div className="p-3 text-center text-text-muted text-sm">
                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
              </div>
            ) : walletData && (
              <WalletSummary
                discipline={discipline}
                liftBalance={liftBalance}
                monetaryBalance={Number(walletData.wallet?.monetary_balance || 0)}
              />
            )}

            {/* Tipo partecipazione */}
            <div className="grid grid-cols-2 gap-4">
              <Select label="Tipo partecipazione" {...register('participation_type')}>
                <option value="lift">Lift</option>
                <option value="lift_supervisionato">Lift assistito</option>
                <option value="corso">Corso</option>
              </Select>
              <Select label="Noleggio" {...register('rental_type')}>
                <option value="nessuno">Nessuno</option>
                <option value="kite_completo">Kite + tavola</option>
                <option value="kite">Solo kite</option>
                <option value="tavola">Solo tavola</option>
                <option value="wingfoil">Wingfoil</option>
                <option value="trapezio">Trapezio</option>
                <option value="muta">Muta</option>
                <option value="casco_giubbotto">Casco/giubbotto</option>
              </Select>
            </div>

            {/* Modalita di addebito */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-text">
                Come addebitiamo questo lift?
              </label>

              <BillingOption
                value="consume_package"
                current={billingMode}
                onChange={(v) => setValue('billing_mode', v)}
                disabled={availablePackages.length === 0}
                label="Consuma da pacchetto"
                desc={
                  availablePackages.length > 0
                    ? `Scala 1 lift dal pacchetto residuo`
                    : `Nessun pacchetto disponibile per ${DISCIPLINE_LABELS[discipline]}`
                }
              />

              {billingMode === 'consume_package' && availablePackages.length > 1 && (
                <Select
                  label="Da quale pacchetto?"
                  {...register('package_id')}
                >
                  {availablePackages.map((p, i) => (
                    <option key={p.id} value={p.id}>
                      {p.service_name_snapshot} ({p.lifts_total - p.lifts_used} residui)
                      {i === 0 ? ' [piu vecchio - consigliato]' : ''}
                    </option>
                  ))}
                </Select>
              )}

              <BillingOption
                value="charge_paid"
                current={billingMode}
                onChange={(v) => setValue('billing_mode', v)}
                label="Pagamento immediato"
                desc="Il socio paga ora il lift singolo"
              />

              <BillingOption
                value="charge_unpaid"
                current={billingMode}
                onChange={(v) => setValue('billing_mode', v)}
                label="Addebita (pagher&aacute; dopo)"
                desc="Aggiunge un debito al wallet"
              />

              <BillingOption
                value="no_charge"
                current={billingMode}
                onChange={(v) => setValue('billing_mode', v)}
                label="Nessun addebito"
                desc="Solo registra la presenza, senza ricaduta sul wallet"
              />

              {(billingMode === 'charge_paid' || billingMode === 'charge_unpaid') && (
                <div className="grid grid-cols-2 gap-3 pl-6 pt-1">
                  <Input
                    label="Importo €"
                    type="number"
                    step="0.01"
                    min={0}
                    {...register('charge_amount')}
                  />
                  {billingMode === 'charge_paid' && (
                    <Select label="Metodo" {...register('payment_method')}>
                      {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                        <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
                      ))}
                    </Select>
                  )}
                </div>
              )}
            </div>

            <Textarea label="Note" {...register('notes')} />
          </div>
        )}

        {error && (
          <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annulla</Button>
          <Button type="submit" disabled={submitting || !memberId}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Aggiungi partecipante
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function WalletSummary({
  discipline, liftBalance, monetaryBalance,
}: {
  discipline: LiftDiscipline;
  liftBalance?: LiftBalance;
  monetaryBalance: number;
}) {
  const isInDebt = monetaryBalance < 0;
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className={cn(
        'p-3 rounded border',
        liftBalance && liftBalance.lifts_remaining > 0
          ? 'bg-emerald-500/5 border-emerald-500/30'
          : 'bg-bg-elevated border-border'
      )}>
        <div className="text-[10px] uppercase tracking-widest text-text-dim flex items-center gap-1">
          <Wind className="h-3 w-3" />
          Lift {DISCIPLINE_LABELS[discipline]}
        </div>
        <div className={cn(
          'font-display text-2xl font-bold mt-1',
          liftBalance && liftBalance.lifts_remaining > 0 ? 'text-emerald-400' : 'text-text-dim'
        )}>
          {liftBalance?.lifts_remaining || 0}
        </div>
      </div>
      <div className={cn(
        'p-3 rounded border',
        isInDebt
          ? 'bg-amber-500/5 border-amber-500/30'
          : 'bg-bg-elevated border-border'
      )}>
        <div className="text-[10px] uppercase tracking-widest text-text-dim flex items-center gap-1">
          <Euro className="h-3 w-3" />
          {isInDebt ? 'Saldo debito' : 'Saldo monetario'}
        </div>
        <div className={cn(
          'font-display text-2xl font-bold mt-1',
          isInDebt ? 'text-amber-400' : 'text-text'
        )}>
          {isInDebt ? '-' : ''}€ {Math.abs(monetaryBalance).toFixed(2)}
        </div>
      </div>
    </div>
  );
}

function BillingOption({
  value, current, onChange, label, desc, disabled,
}: {
  value: 'consume_package' | 'charge_paid' | 'charge_unpaid' | 'no_charge';
  current: string;
  onChange: (v: 'consume_package' | 'charge_paid' | 'charge_unpaid' | 'no_charge') => void;
  label: string;
  desc: string;
  disabled?: boolean;
}) {
  const selected = current === value;
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(value)}
      disabled={disabled}
      className={cn(
        'w-full text-left p-3 rounded border flex items-start gap-3 transition-colors',
        selected
          ? 'bg-accent/10 border-accent'
          : 'bg-bg-elevated border-border hover:border-text-muted',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      <div className={cn(
        'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5',
        selected ? 'border-accent bg-accent' : 'border-border'
      )}>
        {selected && <Check className="h-2.5 w-2.5 text-bg" />}
      </div>
      <div className="flex-1">
        <div className={cn('text-sm font-medium', selected ? 'text-accent' : 'text-text')}>
          {label}
        </div>
        <div className="text-xs text-text-muted mt-0.5" dangerouslySetInnerHTML={{ __html: desc }} />
      </div>
    </button>
  );
}
