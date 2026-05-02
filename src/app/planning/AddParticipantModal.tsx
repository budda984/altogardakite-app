'use client';

import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Loader2, Search, Wind, Euro, Sparkles, Check, AlertCircle, Receipt,
} from 'lucide-react';
import { z } from 'zod';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import type {
  Member, Service, Package, ActiveSubscription,
  LiftDiscipline,
} from '@/lib/types';
import { DISCIPLINE_LABELS } from '@/lib/types';
import { findRentalService, findSingleLiftService } from '@/lib/rental-pricing';
import { cn } from '@/lib/utils';

const participantSchema = z.object({
  member_id: z.string().uuid('Socio obbligatorio'),
  participation_type: z.enum(['corso', 'lift_supervisionato', 'lift_semplice']).default('lift_semplice'),
  rental_type: z.enum([
    'nessuno', 'completo', 'solo_tavola', 'solo_kite', 'solo_barra',
    'solo_trapezio', 'solo_muta', 'solo_giubbotto', 'wing_completo', 'altro',
  ]).default('nessuno'),
  rental_charge_amount: z.coerce.number().min(0).nullable().optional(),
  notes: z.string().optional().or(z.literal('')),
});

type ParticipantFormData = z.infer<typeof participantSchema>;

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
    packages: Package[];
    active_subscriptions: ActiveSubscription[];
  } | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);

  const discipline = outing.discipline || 'kite';

  const {
    register, handleSubmit, reset, watch, setValue, formState: { errors },
  } = useForm<ParticipantFormData>({
    resolver: zodResolver(participantSchema),
    defaultValues: {
      participation_type: 'lift_semplice',
      rental_type: 'nessuno',
    },
  });

  const memberId = watch('member_id');
  const participationType = watch('participation_type');
  const rentalType = watch('rental_type');

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
      .then((data) => setWalletData({
        packages: data.packages,
        active_subscriptions: data.active_subscriptions,
      }))
      .catch(() => setWalletData(null))
      .finally(() => setWalletLoading(false));
  }, [memberId]);

  // Reset al cambio open
  useEffect(() => {
    if (open) {
      reset({
        member_id: undefined,
        participation_type: 'lift_semplice',
        rental_type: 'nessuno',
        rental_charge_amount: null,
        notes: '',
      });
      setMemberSearch('');
      setWalletData(null);
      setError(null);
    }
  }, [open, reset]);

  const onSubmit = async (data: ParticipantFormData) => {
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

  // Calcola anteprima addebito
  const preview = useMemo(() => {
    if (!walletData || !memberId) return null;

    const result: { items: { label: string; cost: number; covered: 'sub' | 'pkg' | 'paid' | 'pending' }[]; total: number } = {
      items: [],
      total: 0,
    };

    // Lift?
    if (participationType === 'lift_semplice' || participationType === 'lift_supervisionato') {
      const hasLiftSub = walletData.active_subscriptions.some(
        (s) => s.discipline === discipline
      );
      if (hasLiftSub) {
        result.items.push({ label: `Lift ${DISCIPLINE_LABELS[discipline]}`, cost: 0, covered: 'sub' });
      } else {
        const liftPackages = walletData.packages.filter(
          (p) => !p.is_subscription && !p.is_exhausted && p.discipline === discipline
        );
        if (liftPackages.length > 0) {
          result.items.push({ label: `Lift ${DISCIPLINE_LABELS[discipline]}`, cost: 0, covered: 'pkg' });
        } else {
          const liftSvc = findSingleLiftService(discipline, services);
          const cost = liftSvc?.unit_price || 35;
          result.items.push({ label: `Lift ${DISCIPLINE_LABELS[discipline]}`, cost, covered: 'pending' });
          result.total += cost;
        }
      }
    }

    // Noleggio?
    if (rentalType !== 'nessuno') {
      const hasAttrSub = walletData.active_subscriptions.some(
        (s) => s.service_name_snapshot.toLowerCase().includes('attrezzatura')
      );
      const rentalSvc = findRentalService(rentalType, services);
      const cost = rentalSvc?.unit_price || 0;
      const label = `Noleggio ${rentalType.replace('_', ' ')}`;
      if (hasAttrSub) {
        result.items.push({ label, cost: 0, covered: 'sub' });
      } else if (cost > 0) {
        result.items.push({ label, cost, covered: 'pending' });
        result.total += cost;
      }
    }

    return result;
  }, [walletData, memberId, participationType, rentalType, discipline, services]);

  const liftPackages = walletData?.packages.filter(
    (p) => !p.is_subscription && !p.is_exhausted && p.discipline === discipline
  ) || [];
  const totalLiftsRemaining = liftPackages.reduce((sum, p) => sum + (p.lifts_total - p.lifts_used), 0);
  const liftSub = walletData?.active_subscriptions.find((s) => s.discipline === discipline);
  const attrSub = walletData?.active_subscriptions.find(
    (s) => s.service_name_snapshot.toLowerCase().includes('attrezzatura')
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Aggiungi partecipante a ${outing.boat?.name || 'uscita'}`}
      description={`Disciplina dell'uscita: ${DISCIPLINE_LABELS[discipline]} · gli addebiti saranno generati alla chiusura`}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
                    <span className="text-text">{m.last_name} {m.first_name}</span>
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
                onClick={() => { setValue('member_id', ''); setMemberSearch(''); }}
                className="text-xs text-accent hover:underline"
              >
                Cambia socio
              </button>
            </div>

            {/* Banner abbonamenti attivi */}
            {walletLoading ? (
              <div className="p-3 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto text-text-muted" /></div>
            ) : walletData && (
              <div className="space-y-2">
                {liftSub && (
                  <SubscriptionBanner
                    icon={<Sparkles className="h-4 w-4" />}
                    text={`Abbonamento ${DISCIPLINE_LABELS[discipline]}: ${liftSub.service_name_snapshot}`}
                    days={liftSub.days_remaining}
                  />
                )}
                {attrSub && (
                  <SubscriptionBanner
                    icon={<Sparkles className="h-4 w-4" />}
                    text={`Abbonamento attrezzatura: ${attrSub.service_name_snapshot}`}
                    days={attrSub.days_remaining}
                  />
                )}
                {!liftSub && totalLiftsRemaining > 0 && (
                  <div className="p-2.5 rounded-md bg-emerald-500/5 border border-emerald-500/20 text-xs flex items-center gap-2">
                    <Wind className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-text-muted">
                      Lift {DISCIPLINE_LABELS[discipline]} residui:{' '}
                      <strong className="text-emerald-400">{totalLiftsRemaining}</strong>
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Tipo partecipazione */}
            <div className="grid grid-cols-2 gap-4">
              <Select label="Tipo partecipazione" {...register('participation_type')}>
                <option value="lift_semplice">Lift semplice</option>
                <option value="lift_supervisionato">Lift assistito / supervisionato</option>
                <option value="corso">Corso (non addebitato qui)</option>
              </Select>
              <Select label="Noleggio attrezzatura" {...register('rental_type')}>
                <option value="nessuno">Nessuno</option>
                <option value="completo">Kit completo (kite + tavola)</option>
                <option value="wing_completo">Wingfoil completo</option>
                <option value="solo_kite">Solo kite</option>
                <option value="solo_tavola">Solo tavola</option>
                <option value="solo_barra">Solo barra</option>
                <option value="solo_trapezio">Solo trapezio</option>
                <option value="solo_muta">Solo muta</option>
                <option value="solo_giubbotto">Solo giubbotto/casco</option>
                <option value="altro">Altro</option>
              </Select>
            </div>

            {/* Anteprima addebito alla chiusura */}
            {preview && preview.items.length > 0 && (
              <div className="p-3 rounded border border-border bg-bg-elevated space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-text-muted">
                  <Receipt className="h-3.5 w-3.5" />
                  Alla chiusura uscita verrà addebitato:
                </div>
                <div className="space-y-1.5">
                  {preview.items.map((item, i) => (
                    <PreviewLine key={i} {...item} />
                  ))}
                </div>
                {preview.total > 0 && (
                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-text-muted">Totale da addebitare</span>
                    <span className="font-display font-bold text-amber-400 flex items-center gap-1">
                      <Euro className="h-3.5 w-3.5" />
                      {preview.total.toFixed(2)}
                    </span>
                  </div>
                )}
                {preview.total === 0 && preview.items.length > 0 && (
                  <div className="pt-2 border-t border-border text-xs text-emerald-400 flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5" />
                    Tutto coperto da abbonamenti / pacchetti
                  </div>
                )}
              </div>
            )}

            <Textarea
              label="Note sul partecipante"
              {...register('notes')}
              placeholder="es. principiante, prima volta, attenzione particolare"
            />
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

function SubscriptionBanner({ icon, text, days }: { icon: React.ReactNode; text: string; days: number }) {
  return (
    <div className="p-2.5 rounded-md bg-accent/5 border border-accent/30 text-xs flex items-center gap-2">
      <span className="text-accent">{icon}</span>
      <span className="text-text flex-1">{text}</span>
      <span className={cn(
        'text-[10px]',
        days < 14 ? 'text-amber-400' : 'text-text-muted'
      )}>
        {days} giorni
      </span>
    </div>
  );
}

function PreviewLine({
  label, cost, covered,
}: {
  label: string;
  cost: number;
  covered: 'sub' | 'pkg' | 'paid' | 'pending';
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-text">{label}</span>
      <div className="flex items-center gap-2">
        {covered === 'sub' && (
          <span className="px-2 py-0.5 rounded bg-accent/10 text-accent text-[10px]">
            abbonamento
          </span>
        )}
        {covered === 'pkg' && (
          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px]">
            scala da pacchetto
          </span>
        )}
        {covered === 'pending' && (
          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px]">
            addebito
          </span>
        )}
        <span className={cn(
          'font-display font-medium',
          cost === 0 ? 'text-text-dim' : 'text-amber-400'
        )}>
          € {cost.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
