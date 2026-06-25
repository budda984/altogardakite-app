'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Loader2, Search, Wind, Euro, Sparkles, Check, AlertCircle, Receipt,
  X as XIcon, GraduationCap,
} from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import type {
  Member, Service, LiftDiscipline,
} from '@/lib/types';
import { DISCIPLINE_LABELS } from '@/lib/types';
import { findRentalService, findSingleLiftService } from '@/lib/rental-pricing';
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

type ParticipationType = 'corso' | 'lift_supervisionato' | 'lift_semplice';
type RentalType =
  | 'nessuno' | 'completo' | 'solo_tavola' | 'solo_kite' | 'solo_barra'
  | 'solo_trapezio' | 'solo_muta' | 'solo_giubbotto' | 'wing_completo' | 'altro';

interface MemberSelection {
  member_id: string;
  participation_type: ParticipationType;
  rental_type: RentalType;
  notes: string;
}

export default function AddParticipantModal({
  open, onClose, outing, members, services, onSuccess,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [selections, setSelections] = useState<MemberSelection[]>([]);

  // Defaults applicati a TUTTI i nuovi soci aggiunti finché non li modifichi singolarmente
  const [defaultParticipation, setDefaultParticipation] = useState<ParticipationType>('lift_semplice');
  const [defaultRental, setDefaultRental] = useState<RentalType>('nessuno');

  const discipline = outing.discipline || 'kite';

  useEffect(() => {
    if (open) {
      setSelections([]);
      setMemberSearch('');
      setDefaultParticipation('lift_semplice');
      setDefaultRental('nessuno');
      setError(null);
    }
  }, [open]);

  // Soci disponibili (esclusi quelli già selezionati)
  const availableMembers = useMemo(() => {
    const selectedIds = new Set(selections.map((s) => s.member_id));
    return members.filter((m) => !selectedIds.has(m.id));
  }, [members, selections]);

  // Filtraggio ricerca
  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return availableMembers.slice(0, 30);
    const q = memberSearch.toLowerCase();
    return availableMembers.filter((m) =>
      `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
      String(m.membership_number).includes(q)
    ).slice(0, 30);
  }, [availableMembers, memberSearch]);

  const addMember = (memberId: string) => {
    setSelections((prev) => [
      ...prev,
      {
        member_id: memberId,
        participation_type: defaultParticipation,
        rental_type: defaultRental,
        notes: '',
      },
    ]);
    setMemberSearch('');
  };

  const removeSelection = (memberId: string) => {
    setSelections((prev) => prev.filter((s) => s.member_id !== memberId));
  };

  const updateSelection = (memberId: string, patch: Partial<MemberSelection>) => {
    setSelections((prev) => prev.map((s) =>
      s.member_id === memberId ? { ...s, ...patch } : s
    ));
  };

  const handleSubmit = async () => {
    if (selections.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      // Una chiamata per ogni socio (l'API è single-record-based)
      const results = await Promise.allSettled(
        selections.map((s) =>
          fetch(`/api/planning/uscita/${outing.id}/partecipanti`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(s),
          }).then(async (r) => {
            if (!r.ok) {
              const j = await r.json().catch(() => ({}));
              throw new Error(j.error || 'Errore');
            }
          })
        )
      );
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length > 0) {
        const reasons = failed.map((r) =>
          r.status === 'rejected' ? (r.reason instanceof Error ? r.reason.message : String(r.reason)) : ''
        );
        throw new Error(
          `${failed.length} su ${selections.length} non aggiunti. Cause: ${[...new Set(reasons)].join(', ')}`
        );
      }
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore');
    } finally {
      setSubmitting(false);
    }
  };

  const memberById = useMemo(() => {
    const map: Record<string, typeof members[number]> = {};
    members.forEach((m) => { map[m.id] = m; });
    return map;
  }, [members]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Aggiungi partecipanti a ${outing.boat?.name || 'uscita'}`}
      description={`Disciplina dell'uscita: ${DISCIPLINE_LABELS[discipline]} · gli addebiti saranno generati alla chiusura`}
      size="xl"
    >
      <div className="space-y-5">
        {/* Default per nuovi inserimenti */}
        <div className="p-3 rounded bg-bg-elevated border border-border space-y-3">
          <div className="text-xs font-medium text-text-muted">
            Impostazioni di default per i nuovi soci aggiunti:
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Tipo partecipazione"
              value={defaultParticipation}
              onChange={(e) => setDefaultParticipation(e.target.value as ParticipationType)}
            >
              <option value="lift_semplice">Lift semplice</option>
              <option value="lift_supervisionato">Lift assistito / supervisionato</option>
              <option value="corso">Corso (lezione)</option>
            </Select>
            <Select
              label="Noleggio attrezzatura"
              value={defaultRental}
              onChange={(e) => setDefaultRental(e.target.value as RentalType)}
            >
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
          <p className="text-[10px] text-text-dim">
            Puoi modificare partecipazione e noleggio singolarmente nella lista qui sotto.
          </p>
        </div>

        {/* Search soci */}
        <div>
          <label className="block text-sm font-medium text-text mb-2">
            Cerca e aggiungi soci ({selections.length} selezionati)
          </label>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-dim" />
            <input
              placeholder="Cognome, nome o numero tessera..."
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-md border border-border bg-bg-elevated text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            />
          </div>
          {memberSearch && (
            <div className="max-h-60 overflow-y-auto bg-bg-elevated border border-border rounded divide-y divide-border">
              {filteredMembers.length === 0 ? (
                <p className="p-3 text-sm text-text-muted text-center">Nessun socio trovato.</p>
              ) : (
                filteredMembers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => addMember(m.id)}
                    className="w-full p-2.5 text-left hover:bg-bg-surface text-sm flex items-center justify-between"
                  >
                    <span className="text-text">{m.first_name} {m.last_name}</span>
                    <span className="text-xs text-text-dim">#{m.membership_number}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Selezionati */}
        {selections.length > 0 && (
          <div>
            <div className="text-xs font-medium text-text-muted mb-2">
              Da aggiungere ({selections.length}):
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {selections.map((s) => {
                const m = memberById[s.member_id];
                if (!m) return null;
                return (
                  <SelectionRow
                    key={s.member_id}
                    member={m}
                    selection={s}
                    onUpdate={(patch) => updateSelection(s.member_id, patch)}
                    onRemove={() => removeSelection(s.member_id)}
                    discipline={discipline}
                    services={services}
                  />
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose}>Annulla</Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || selections.length === 0}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Aggiungi {selections.length} {selections.length === 1 ? 'partecipante' : 'partecipanti'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// SelectionRow — una riga per ogni socio aggiunto, modificabile inline
// ============================================================================
function SelectionRow({
  member, selection, onUpdate, onRemove, discipline, services,
}: {
  member: { id: string; first_name: string; last_name: string; membership_number: number };
  selection: MemberSelection;
  onUpdate: (patch: Partial<MemberSelection>) => void;
  onRemove: () => void;
  discipline: LiftDiscipline;
  services: Service[];
}) {
  const [walletData, setWalletData] = useState<{
    has_lift_subscription: boolean;
    has_attr_subscription: boolean;
    lift_remaining: number;
    course_remaining: number;
  } | null>(null);

  // Carica wallet semplificato (un solo fetch per riga)
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/soci/${member.id}/wallet`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const liftSub = (data.active_subscriptions || []).some(
          (s: { discipline: string }) => s.discipline === discipline
        );
        const attrSub = (data.active_subscriptions || []).some(
          (s: { service_name_snapshot: string }) =>
            s.service_name_snapshot.toLowerCase().includes('attrezzatura')
        );
        const liftRem = (data.lift_balances || [])
          .filter((b: { discipline: string }) => b.discipline === discipline)
          .reduce((sum: number, b: { lifts_remaining: number }) => sum + b.lifts_remaining, 0);
        const courseRem = (data.lift_balances || [])
          .filter((b: { discipline: string }) => b.discipline === 'corso')
          .reduce((sum: number, b: { lifts_remaining: number }) => sum + b.lifts_remaining, 0);

        setWalletData({
          has_lift_subscription: liftSub,
          has_attr_subscription: attrSub,
          lift_remaining: liftRem,
          course_remaining: courseRem,
        });
      })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [member.id, discipline]);

  // Calcolo preview
  const preview = useMemo(() => {
    if (!walletData) return null;
    const items: { label: string; covered: 'sub' | 'pkg' | 'pending'; cost: number }[] = [];

    // Lift / corso?
    if (selection.participation_type === 'corso') {
      if (walletData.course_remaining > 0) {
        items.push({ label: 'Lezione', covered: 'pkg', cost: 0 });
      } else {
        const lessonSvc = services.find((s) => s.slug === 'lezione_singola');
        items.push({ label: 'Lezione', covered: 'pending', cost: lessonSvc?.unit_price || 60 });
      }
    } else if (
      selection.participation_type === 'lift_semplice' ||
      selection.participation_type === 'lift_supervisionato'
    ) {
      if (walletData.has_lift_subscription) {
        items.push({ label: `Lift ${DISCIPLINE_LABELS[discipline]}`, covered: 'sub', cost: 0 });
      } else if (walletData.lift_remaining > 0) {
        items.push({ label: `Lift ${DISCIPLINE_LABELS[discipline]}`, covered: 'pkg', cost: 0 });
      } else {
        const liftSvc = findSingleLiftService(discipline, services);
        items.push({ label: `Lift ${DISCIPLINE_LABELS[discipline]}`, covered: 'pending', cost: liftSvc?.unit_price || 35 });
      }
    }

    if (selection.rental_type !== 'nessuno') {
      const label = `Noleggio ${selection.rental_type.replace('_', ' ')}`;
      if (walletData.has_attr_subscription) {
        items.push({ label, covered: 'sub', cost: 0 });
      } else {
        const svc = findRentalService(selection.rental_type, services);
        const cost = svc?.unit_price || 0;
        if (cost > 0) {
          items.push({ label, covered: 'pending', cost });
        }
      }
    }

    return {
      items,
      total: items.reduce((sum, i) => sum + i.cost, 0),
    };
  }, [walletData, selection, services, discipline]);

  return (
    <div className="p-3 rounded border border-border bg-bg-elevated/50">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-text text-sm flex items-center gap-2 flex-wrap">
            <span>{member.first_name} {member.last_name}</span>
            <span className="text-xs text-text-dim">#{member.membership_number}</span>
            {walletData?.has_lift_subscription && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-accent/10 text-accent">
                <Sparkles className="h-2.5 w-2.5" />
                abb. {DISCIPLINE_LABELS[discipline]}
              </span>
            )}
            {walletData?.has_attr_subscription && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-accent/10 text-accent">
                <Sparkles className="h-2.5 w-2.5" />
                abb. attrezz.
              </span>
            )}
            {walletData && walletData.lift_remaining > 0 && !walletData.has_lift_subscription && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-emerald-500/10 text-emerald-400">
                <Wind className="h-2.5 w-2.5" />
                {walletData.lift_remaining} lift
              </span>
            )}
            {selection.participation_type === 'corso' && walletData && walletData.course_remaining > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-emerald-500/10 text-emerald-400">
                <GraduationCap className="h-2.5 w-2.5" />
                {walletData.course_remaining} lezioni
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="p-1 rounded hover:bg-red-500/10 text-text-dim hover:text-red-400"
          title="Rimuovi"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <select
          value={selection.participation_type}
          onChange={(e) => onUpdate({ participation_type: e.target.value as ParticipationType })}
          className="text-xs rounded bg-bg border border-border px-2 py-1.5 text-text"
          style={{ colorScheme: 'dark' }}
        >
          <option value="lift_semplice">Lift semplice</option>
          <option value="lift_supervisionato">Lift assistito</option>
          <option value="corso">Corso (lezione)</option>
        </select>
        <select
          value={selection.rental_type}
          onChange={(e) => onUpdate({ rental_type: e.target.value as RentalType })}
          className="text-xs rounded bg-bg border border-border px-2 py-1.5 text-text"
          style={{ colorScheme: 'dark' }}
        >
          <option value="nessuno">Nessun noleggio</option>
          <option value="completo">Kit completo</option>
          <option value="wing_completo">Wingfoil completo</option>
          <option value="solo_kite">Solo kite</option>
          <option value="solo_tavola">Solo tavola</option>
          <option value="solo_barra">Solo barra</option>
          <option value="solo_trapezio">Solo trapezio</option>
          <option value="solo_muta">Solo muta</option>
          <option value="solo_giubbotto">Solo giubbotto</option>
          <option value="altro">Altro</option>
        </select>
      </div>

      {preview && preview.items.length > 0 && (
        <div className="text-[10px] text-text-muted flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Receipt className="h-3 w-3" />
            <span>Alla chiusura:</span>
            {preview.items.map((item, i) => (
              <span key={i} className={cn(
                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded',
                item.covered === 'sub' ? 'bg-accent/10 text-accent' :
                item.covered === 'pkg' ? 'bg-emerald-500/10 text-emerald-400' :
                'bg-amber-500/10 text-amber-400'
              )}>
                {item.label}
                {item.cost > 0 && ` €${item.cost.toFixed(2)}`}
              </span>
            ))}
          </div>
          {preview.total > 0 && (
            <span className="font-display font-semibold text-amber-400 flex items-center gap-0.5">
              <Euro className="h-3 w-3" />
              {preview.total.toFixed(2)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
