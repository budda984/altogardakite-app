'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2, CheckCircle2, Heart, User, Wind, FileText } from 'lucide-react';
import Link from 'next/link';

import { memberSchema, type MemberFormData } from '@/lib/validation/schemas';
import { Input } from '@/components/ui/Input';
import { DateInput } from '@/components/ui/DateInput';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Card } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Textarea';
import { isMinor } from '@/lib/utils';
import { MEMBER_TYPE_LABELS, type MemberType } from '@/lib/types';
import { cn } from '@/lib/utils';

const MEMBER_TYPE_DESCRIPTIONS: Record<MemberType, string> = {
  sostenitore: 'Quota di supporto, no certificato medico, non partecipa a uscite',
  normale: 'Tessera standard, partecipa a uscite, certificato medico obbligatorio',
  con_lift: 'Tessera + 1 lift kite incluso (creato automaticamente nel wallet)',
};

export default function NuovoSocioPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    formState: { errors },
  } = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      member_type: 'normale',
      membership_paid_now: true,
      membership_payment_method: 'contanti',
      is_minor: false,
      is_foreign: false,
      medical_cert_received: false,
    },
  });

  const birthDate = watch('birth_date');
  const memberType = watch('member_type');
  const isForeign = watch('is_foreign');
  const isMinorWatch = watch('is_minor');
  const certReceived = watch('medical_cert_received');

  // Auto-detect minore dalla data di nascita
  const autoMinor = birthDate ? isMinor(birthDate) : false;
  if (autoMinor !== isMinorWatch) {
    setValue('is_minor', autoMinor);
  }

  const onSubmit = async (data: MemberFormData) => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/soci', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Errore creazione socio');
      }

      setSuccess(result.id);
      setTimeout(() => router.push(`/soci/${result.id}`), 800);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Errore');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="p-6 lg:p-10 max-w-2xl flex flex-col items-center justify-center min-h-[60vh]">
        <CheckCircle2 className="h-16 w-16 text-emerald-400 mb-4" />
        <h1 className="font-display text-3xl font-bold mb-2">Socio creato</h1>
        <p className="text-text-muted">Reindirizzamento alla scheda...</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-3xl pb-24 lg:pb-10">
      <div className="mb-6">
        <Link href="/soci" className="text-sm text-text-muted hover:text-text inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          Torna ai soci
        </Link>
      </div>

      <h1 className="font-display text-3xl font-bold tracking-tight mb-2">Nuovo socio</h1>
      <p className="text-sm text-text-muted mb-8">
        Inserisci i dati essenziali. Le firme e dichiarazioni vengono raccolte sul modulo cartaceo.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* TIPO ASSOCIATIVO */}
        <Card title="Tipo socio">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(Object.keys(MEMBER_TYPE_LABELS) as MemberType[]).map((t) => {
              const isSelected = memberType === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setValue('member_type', t)}
                  className={cn(
                    'p-4 rounded-lg border text-left transition-colors',
                    isSelected
                      ? 'bg-accent/10 border-accent'
                      : 'bg-bg-surface border-border hover:border-text-muted'
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {t === 'sostenitore' && <Heart className={cn('h-4 w-4', isSelected ? 'text-accent' : 'text-text-muted')} />}
                    {t === 'normale' && <User className={cn('h-4 w-4', isSelected ? 'text-accent' : 'text-text-muted')} />}
                    {t === 'con_lift' && <Wind className={cn('h-4 w-4', isSelected ? 'text-accent' : 'text-text-muted')} />}
                    <span className={cn('font-medium', isSelected ? 'text-accent' : 'text-text')}>
                      {MEMBER_TYPE_LABELS[t]}
                    </span>
                  </div>
                  <div className="text-xs text-text-muted">{MEMBER_TYPE_DESCRIPTIONS[t]}</div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* ANAGRAFICA */}
        <Card title="Anagrafica">
          <div className="grid md:grid-cols-2 gap-4">
            <Input label="Nome" required {...register('first_name')} error={errors.first_name?.message} />
            <Input label="Cognome" required {...register('last_name')} error={errors.last_name?.message} />
            <Controller
              control={control}
              name="birth_date"
              render={({ field }) => (
                <DateInput
                  label="Data di nascita"
                  required
                  value={field.value || ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.birth_date?.message}
                  hint="gg/mm/aaaa"
                />
              )}
            />
            <Input label="Luogo di nascita" {...register('birth_place')} />
            <Input label="Provincia" maxLength={2} {...register('birth_province')} className="uppercase" />
            <Input label="Telefono" type="tel" required {...register('phone')} error={errors.phone?.message} />
            <Input label="Email" type="email" required {...register('email')} error={errors.email?.message} className="md:col-span-2" />
            <Input label="Indirizzo" required {...register('address')} error={errors.address?.message} placeholder="Via, civico, citta'" className="md:col-span-2" />
          </div>

          {/* Stranieri */}
          <div className="mt-4 p-3 rounded bg-bg-elevated border border-border space-y-3">
            <Checkbox label="Socio straniero (senza codice fiscale italiano)" {...register('is_foreign')} />
            {isForeign ? (
              <Input
                label="Documento di identita"
                {...register('foreign_id_doc')}
                placeholder="es. Passaporto AB1234567"
                hint="Numero passaporto o documento equivalente"
              />
            ) : (
              <Input
                label="Codice fiscale"
                required
                {...register('fiscal_code')}
                error={errors.fiscal_code?.message}
                className="uppercase font-mono"
                placeholder="RSSMRA80A01H501Z"
              />
            )}
          </div>
        </Card>

        {/* DATI GENITORE SE MINORE */}
        {autoMinor && (
          <Card
            title="Dati genitore"
            description="Obbligatorio per minori. Le firme cartacee dovranno essere apposte dal genitore."
          >
            <div className="grid md:grid-cols-2 gap-4">
              <Input label="Nome genitore" required {...register('parent_first_name')} error={errors.parent_first_name?.message} />
              <Input label="Cognome genitore" required {...register('parent_last_name')} error={errors.parent_last_name?.message} />
              <Input label="Telefono genitore" type="tel" required {...register('parent_phone')} />
              <Input label="Email genitore" type="email" {...register('parent_email')} />
            </div>
          </Card>
        )}

        {/* CERTIFICATO MEDICO */}
        {memberType !== 'sostenitore' && (
          <Card
            title="Certificato medico"
            description="Obbligatorio per soci normali e con lift. Lascia non spuntato se non e' stato ancora consegnato."
          >
            <Checkbox label="Certificato consegnato" {...register('medical_cert_received')} />
            {certReceived && (
              <div className="mt-4">
                <Controller
                  control={control}
                  name="medical_cert_expires_at"
                  render={({ field }) => (
                    <DateInput
                      label="Data scadenza"
                      required
                      value={field.value || ''}
                      onChange={field.onChange}
                      error={errors.medical_cert_expires_at?.message}
                      hint="Riceverai un alert 30 giorni prima della scadenza"
                    />
                  )}
                />
              </div>
            )}
          </Card>
        )}

        {/* NOTE */}
        <Card title="Note interne">
          <Textarea {...register('notes')} placeholder="Eventuali note utili (allergie, preferenze, ecc.)" />
        </Card>

        {submitError && (
          <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            {submitError}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={() => router.back()}>Annulla</Button>
          <Button type="submit" disabled={submitting} size="lg">
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <FileText className="h-4 w-4 mr-2" />
            Crea socio
          </Button>
        </div>
      </form>
    </div>
  );
}
