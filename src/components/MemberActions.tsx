'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Pencil, Loader2, RefreshCcw, Wand2, Heart, User, Wind,
} from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/ui/Input';
import { DateInput } from '@/components/ui/DateInput';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import {
  memberEditSchema, type MemberEditFormData,
  renewMembershipSchema, type RenewMembershipFormData,
  adjustCreditsSchema, type AdjustCreditsFormData,
} from '@/lib/validation/admin-schemas';
import {
  type MemberType, MEMBER_TYPE_LABELS,
  DISCIPLINE_LABELS,
} from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';

interface MemberData {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address_street: string | null;
  fiscal_code: string | null;
  notes: string | null;
  member_type: MemberType;
  expires_at: string | null;
  medical_cert_received: boolean;
  medical_cert_expires_at: string | null;
}

interface Props {
  member: MemberData;
  isAdmin: boolean;
}

export default function MemberActions({ member, isAdmin }: Props) {
  const [showEdit, setShowEdit] = useState(false);
  const [showRenew, setShowRenew] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" onClick={() => setShowEdit(true)}>
        <Pencil className="h-3.5 w-3.5 mr-1.5" />
        Modifica
      </Button>
      <Button size="sm" variant="secondary" onClick={() => setShowRenew(true)}>
        <RefreshCcw className="h-3.5 w-3.5 mr-1.5" />
        Rinnova tessera
      </Button>
      {isAdmin && (
        <Button size="sm" variant="ghost" onClick={() => setShowAdjust(true)}>
          <Wand2 className="h-3.5 w-3.5 mr-1.5" />
          Aggiusta crediti
        </Button>
      )}

      {showEdit && <EditModal member={member} onClose={() => setShowEdit(false)} />}
      {showRenew && <RenewModal member={member} onClose={() => setShowRenew(false)} />}
      {showAdjust && <AdjustCreditsModal memberId={member.id} onClose={() => setShowAdjust(false)} />}
    </div>
  );
}

// ============================================================================
// EDIT
// ============================================================================
function EditModal({ member, onClose }: { member: MemberData; onClose: () => void }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register, handleSubmit, control, watch, formState: { errors },
  } = useForm<MemberEditFormData>({
    resolver: zodResolver(memberEditSchema),
    defaultValues: {
      first_name: member.first_name,
      last_name: member.last_name,
      email: member.email || '',
      phone: member.phone || '',
      address: member.address_street || '',
      fiscal_code: member.fiscal_code || '',
      notes: member.notes || '',
      medical_cert_received: member.medical_cert_received,
      medical_cert_expires_at: member.medical_cert_expires_at || '',
    },
  });

  const certReceived = watch('medical_cert_received');

  const onSubmit = async (data: MemberEditFormData) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/soci/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Errore salvataggio');
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Modifica anagrafica" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Nome *" {...register('first_name')} error={errors.first_name?.message} />
          <Input label="Cognome *" {...register('last_name')} error={errors.last_name?.message} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
          <Input label="Telefono" {...register('phone')} />
        </div>
        <Input label="Codice fiscale" {...register('fiscal_code')} error={errors.fiscal_code?.message} className="uppercase font-mono" />
        <Input label="Indirizzo" {...register('address')} placeholder="Via, civico, citta'" />

        <div className="p-3 rounded bg-bg-elevated border border-border space-y-3">
          <Checkbox label="Certificato medico consegnato" {...register('medical_cert_received')} />
          {certReceived && (
            <Controller
              control={control}
              name="medical_cert_expires_at"
              render={({ field }) => (
                <DateInput
                  label="Data scadenza certificato"
                  value={field.value || ''}
                  onChange={field.onChange}
                  error={errors.medical_cert_expires_at?.message}
                />
              )}
            />
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
            Salva
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================================
// RINNOVO TESSERA
// ============================================================================
function RenewModal({ member, onClose }: { member: MemberData; onClose: () => void }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, watch, setValue } = useForm<RenewMembershipFormData>({
    resolver: zodResolver(renewMembershipSchema),
    defaultValues: {
      member_type: member.member_type,
      paid_now: true,
      payment_method: 'contanti',
    },
  });

  const memberType = watch('member_type');

  const onSubmit = async (data: RenewMembershipFormData) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/soci/${member.id}/rinnova`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Errore');
      const newExp = new Date(result.expires_at);
      alert(
        `Tessera rinnovata.\n` +
        `Tipo: ${MEMBER_TYPE_LABELS[data.member_type]}\n` +
        `Scadenza: ${newExp.toLocaleDateString('it-IT')}\n` +
        `Importo: € ${result.amount}` +
        (result.package_created ? '\n+ Pacchetto da 1 lift creato nel wallet' : '')
      );
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Rinnova tessera"
      description={member.expires_at
        ? `Scadenza attuale: ${formatDate(member.expires_at)}`
        : 'Tessera non ancora attivata'
      }
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-text mb-2">
            Tipo socio per il rinnovo
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(MEMBER_TYPE_LABELS) as MemberType[]).map((t) => {
              const isSelected = memberType === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setValue('member_type', t)}
                  className={cn(
                    'p-3 rounded-lg border text-left',
                    isSelected
                      ? 'bg-accent/10 border-accent'
                      : 'bg-bg-elevated border-border hover:border-text-muted'
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    {t === 'sostenitore' && <Heart className="h-3.5 w-3.5" />}
                    {t === 'normale' && <User className="h-3.5 w-3.5" />}
                    {t === 'con_lift' && <Wind className="h-3.5 w-3.5" />}
                    <span className={cn('font-medium text-sm', isSelected ? 'text-accent' : 'text-text')}>
                      {MEMBER_TYPE_LABELS[t]}
                    </span>
                  </div>
                  <div className="text-[10px] text-text-muted mt-1">
                    {t === 'sostenitore' && 'Solo socio, no uscite'}
                    {t === 'normale' && 'Tessera con uscite a consumo'}
                    {t === 'con_lift' && '1 lift kite incluso'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-3 rounded bg-emerald-500/5 border border-emerald-500/30 text-xs text-emerald-400">
          La nuova scadenza sara fissata al <strong>30 ottobre dell&apos;anno prossimo</strong>.
          {memberType === 'con_lift' && ' Verra anche aggiunto 1 lift kite al wallet.'}
        </div>

        {error && (
          <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annulla</Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Rinnova tessera
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================================
// AGGIUSTA CREDITI (admin only)
// ============================================================================
function AdjustCreditsModal({ memberId, onClose }: { memberId: string; onClose: () => void }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<AdjustCreditsFormData>({
    resolver: zodResolver(adjustCreditsSchema),
    defaultValues: { discipline: 'kite', lifts_to_add: 0, reason: '' },
  });

  const onSubmit = async (data: AdjustCreditsFormData) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/soci/${memberId}/aggiusta-crediti`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Errore');
      alert(`Crediti aggiustati: ${data.lifts_to_add > 0 ? '+' : ''}${data.lifts_to_add} lift ${data.discipline}`);
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Aggiusta crediti manualmente"
      description="Solo per rettifiche straordinarie (es. lift residui anno scorso)"
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Select label="Disciplina *" {...register('discipline')}>
          <option value="kite">Kite</option>
          <option value="wingfoil">Wingfoil</option>
          <option value="sit_kite">Sit-kite</option>
          <option value="wingfoil_adattato">Wingfoil adattato</option>
          <option value="corso">Corso (lezioni)</option>
          <option value="altro">Altro</option>
        </Select>

        <Input
          label="Numero di lift / lezioni *"
          type="number"
          {...register('lifts_to_add')}
          error={errors.lifts_to_add?.message}
          hint="Positivo per aggiungere, negativo per togliere"
        />

        <Textarea
          label="Motivazione *"
          {...register('reason')}
          error={errors.reason?.message}
          placeholder="es. Riporto crediti residui stagione 2025"
        />

        <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
          Questa operazione verra registrata nello storico movimenti come &quot;Correzione&quot;.
          Visibile in audit. Non e&apos; collegata a nessun servizio del listino.
        </div>

        {error && (
          <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annulla</Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Aggiusta
          </Button>
        </div>
      </form>
    </Modal>
  );
}
