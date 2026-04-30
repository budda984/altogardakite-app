'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

import { memberSchema, type MemberFormData } from '@/lib/validation/schemas';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Card } from '@/components/ui/Card';
import { SignaturePad } from '@/components/SignaturePad';
import { isMinor } from '@/lib/utils';

const SECTIONS = [
  { id: 1, label: 'Anagrafica' },
  { id: 2, label: 'Dichiarazioni' },
  { id: 3, label: 'Navigazione' },
  { id: 4, label: 'Privacy GDPR' },
  { id: 5, label: 'Safeguarding' },
  { id: 6, label: 'Conferma' },
];

export default function NewMemberPage() {
  const router = useRouter();
  const [section, setSection] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      is_minor: false,
      statute_accepted: false,
      medical_certificate: false,
      payment_commitment: false,
      photo_authorization: false,
      navigation_rules_accepted: false,
      safeguarding_acknowledged: false,
      gdpr_consent_1a: false,
      gdpr_consent_1b: false,
    },
  });

  const birthDate = watch('birth_date');
  const isMinorWatch = watch('is_minor');

  // Auto-detect minore quando cambia data nascita
  if (birthDate && isMinor(birthDate) !== isMinorWatch) {
    setValue('is_minor', isMinor(birthDate));
  }

  const goNext = async () => {
    // Valida solo i campi della sezione corrente prima di avanzare
    const fieldsBySection: Record<number, (keyof MemberFormData)[]> = {
      1: ['first_name', 'last_name', 'birth_date', 'birth_place', 'fiscal_code',
          'phone', 'email', 'address_street', 'address_number', 'city', 'cap'],
      2: ['statute_accepted', 'medical_certificate', 'payment_commitment',
          'photo_authorization', 'signature_admission'],
      3: ['navigation_rules_accepted', 'signature_navigation'],
      4: ['gdpr_consent_1a', 'signature_gdpr_1a'],
      5: ['safeguarding_acknowledged', 'signature_safeguarding'],
    };
    const fields = fieldsBySection[section] || [];
    const isValid = await trigger(fields);
    if (isValid) setSection((s) => Math.min(6, s + 1));
  };

  const goBack = () => setSection((s) => Math.max(1, s - 1));

  const onSubmit = async (data: MemberFormData) => {
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch('/api/soci', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Errore registrazione');
      }
      const { id } = await res.json();
      router.push(`/soci/${id}?registered=1`);
    } catch (e: any) {
      setServerError(e.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 lg:p-10 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link href="/soci" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-accent mb-4">
          <ArrowLeft className="h-4 w-4" /> Torna ai soci
        </Link>
        <div className="text-xs uppercase tracking-widest text-text-dim mb-2">Domanda di ammissione</div>
        <h1 className="font-display text-3xl lg:text-4xl font-bold tracking-tightest">
          Nuovo socio
        </h1>
        <p className="mt-2 text-text-muted text-sm">
          Compilare in tutte le sue parti. La firma puo essere apposta direttamente con il dito su tablet/touchscreen.
        </p>
      </div>

      {/* Progress steps */}
      <div className="mb-8 overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
        <div className="flex items-center gap-2 min-w-max lg:min-w-0">
          {SECTIONS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => s.id < section && setSection(s.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-all ${
                  s.id === section
                    ? 'bg-accent text-bg font-semibold'
                    : s.id < section
                    ? 'bg-accent/10 text-accent cursor-pointer'
                    : 'bg-bg-elevated text-text-dim'
                }`}
              >
                {s.id < section && <CheckCircle2 className="h-3 w-3" />}
                <span>{s.id}. {s.label}</span>
              </button>
              {i < SECTIONS.length - 1 && (
                <div className="h-px w-4 bg-border" />
              )}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* SECTION 1: Anagrafica */}
        {section === 1 && (
          <>
            <Card title="Dati anagrafici" description="Dati del richiedente">
              <div className="grid md:grid-cols-2 gap-4">
                <Input label="Nome" required {...register('first_name')} error={errors.first_name?.message} />
                <Input label="Cognome" required {...register('last_name')} error={errors.last_name?.message} />
                <Input label="Data di nascita" type="date" required {...register('birth_date')} error={errors.birth_date?.message} />
                <Input label="Luogo di nascita" required {...register('birth_place')} error={errors.birth_place?.message} />
                <Input label="Provincia (sigla)" maxLength={2} {...register('birth_province')} error={errors.birth_province?.message} className="uppercase" />
                <Input label="Codice fiscale" required {...register('fiscal_code')} error={errors.fiscal_code?.message} className="uppercase font-mono" />
                <Input label="Cellulare" type="tel" required {...register('phone')} error={errors.phone?.message} />
                <Input label="Email" type="email" required {...register('email')} error={errors.email?.message} />
              </div>
            </Card>

            <Card title="Residenza">
              <div className="grid md:grid-cols-3 gap-4">
                <Input label="Via" required className="md:col-span-2" {...register('address_street')} error={errors.address_street?.message} />
                <Input label="Civico" required {...register('address_number')} error={errors.address_number?.message} />
                <Input label="Citta" required className="md:col-span-2" {...register('city')} error={errors.city?.message} />
                <Input label="CAP" required maxLength={5} {...register('cap')} error={errors.cap?.message} />
              </div>
            </Card>

            {/* Sezione minore */}
            {isMinorWatch && (
              <Card
                title="Dati genitore esercente la potesta"
                description="Obbligatorio in caso di minore. La domanda viene presentata dal genitore."
              >
                <div className="grid md:grid-cols-2 gap-4">
                  <Input label="Nome genitore" required {...register('parent_first_name')} error={errors.parent_first_name?.message} />
                  <Input label="Cognome genitore" required {...register('parent_last_name')} error={errors.parent_last_name?.message} />
                  <Input label="Data nascita" type="date" required {...register('parent_birth_date')} />
                  <Input label="Luogo nascita" required {...register('parent_birth_place')} />
                  <Input label="Codice fiscale" required {...register('parent_fiscal_code')} className="uppercase font-mono" />
                  <Input label="Cellulare" type="tel" required {...register('parent_phone')} />
                  <Input label="Via" required className="md:col-span-2" {...register('parent_address_street')} />
                  <Input label="Civico" {...register('parent_address_number')} />
                  <Input label="Citta" {...register('parent_city')} />
                  <Input label="CAP" maxLength={5} {...register('parent_cap')} />
                  <Input label="Email genitore" type="email" className="md:col-span-2" {...register('parent_email')} />
                </div>
              </Card>
            )}
          </>
        )}

        {/* SECTION 2: Dichiarazioni */}
        {section === 2 && (
          <Card
            title="Dichiarazioni del richiedente"
            description="Letto lo Statuto e i Regolamenti, il richiedente DICHIARA:"
          >
            <div className="space-y-4">
              <Checkbox
                label="Di aver preso visione dello Statuto e dei Regolamenti del Circolo e di accettarli e rispettarli in ogni loro punto."
                {...register('statute_accepted')}
                error={errors.statute_accepted?.message}
              />
              <Checkbox
                label="Di essere in possesso di idoneita psicofisica e di aver consegnato (o impegnarsi a consegnare) un certificato medico in corso di validita."
                {...register('medical_certificate')}
                error={errors.medical_certificate?.message}
              />
              <Checkbox
                label="Di impegnarsi al pagamento della quota associativa annuale e dei contributi associativi a seconda dell'attivita scelta."
                {...register('payment_commitment')}
                error={errors.payment_commitment?.message}
              />
              <Checkbox
                label="Di autorizzare la fotografia e/o la ripresa del sottoscritto/del minore, sul sito web, cartaceo e sui canali social utilizzati dal Circolo e nelle bacheche affisse nei locali del medesimo."
                {...register('photo_authorization')}
              />
            </div>

            <div className="mt-8 pt-6 border-t border-border">
              <Controller
                name="signature_admission"
                control={control}
                render={({ field }) => (
                  <SignaturePad
                    label="Firma del richiedente (domanda di ammissione)"
                    required
                    value={field.value}
                    onChange={(v) => field.onChange(v ?? '')}
                    error={errors.signature_admission?.message}
                  />
                )}
              />
            </div>
          </Card>
        )}

        {/* SECTION 3: Navigazione */}
        {section === 3 && (
          <Card
            title="Informativa navigazione lago di Garda"
            description="Prescrizioni della determina provinciale di navigazione"
          >
            <div className="bg-bg-elevated rounded-md p-4 mb-6 text-sm space-y-3">
              <p>Il Kiter deve:</p>
              <ol className="list-decimal pl-6 space-y-2 text-text-muted">
                <li>Essere a conoscenza della determina provinciale di navigazione pubblicata sul sito dell'Associazione e in bacheca presso la sede al lago.</li>
                <li>Indossare obbligatoriamente un giubbotto omologato (EN393 ISO 12405-5, aiuto galleggiamento 50 newton).</li>
                <li>Essere dotato di assicurazione RCA.</li>
              </ol>
              <p className="text-text-muted pt-2 border-t border-border mt-3">
                <strong className="text-text">Eventuali sanzioni</strong> comminate all'Associazione per il mancato rispetto delle prescrizioni saranno addebitate al Socio. Il giubbotto puo essere noleggiato in sede al costo di 5€.
              </p>
            </div>

            <Checkbox
              label="Dichiaro di aver preso visione dell'informativa sulla navigazione e di rispettare le prescrizioni."
              {...register('navigation_rules_accepted')}
              error={errors.navigation_rules_accepted?.message}
            />

            <div className="mt-6">
              <Controller
                name="signature_navigation"
                control={control}
                render={({ field }) => (
                  <SignaturePad
                    label="Firma per presa visione informativa navigazione"
                    required
                    value={field.value}
                    onChange={(v) => field.onChange(v ?? '')}
                    error={errors.signature_navigation?.message}
                  />
                )}
              />
            </div>
          </Card>
        )}

        {/* SECTION 4: GDPR */}
        {section === 4 && (
          <Card
            title="Privacy GDPR — Informativa art. 13 Reg. UE 2016/679"
            description="Trattamento dei dati personali"
          >
            <details className="bg-bg-elevated rounded-md p-4 mb-6 text-sm">
              <summary className="cursor-pointer text-text font-medium">
                Leggi l'informativa completa
              </summary>
              <div className="mt-4 space-y-3 text-text-muted text-xs leading-relaxed">
                <p><strong className="text-text">Titolare:</strong> Circolo Altogarda Kite ASD, Via Monte Oro 5/B, Riva del Garda — info@altogardakite.it</p>
                <p><strong className="text-text">Responsabile:</strong> Matteo Betta — betta.matteo@yahoo.it</p>
                <p><strong className="text-text">Finalita 1a:</strong> Inserimento nel libro soci e tesseramento CSEN. Comunicazione al CONI per Registro Societa Sportive.</p>
                <p><strong className="text-text">Finalita 1b:</strong> Comunicazioni di promozione e diffusione dello sport da parte del CONI (consenso facoltativo).</p>
                <p><strong className="text-text">Conservazione:</strong> per il tempo richiesto da codice civile, normativa fiscale e regolamenti CONI/CSEN.</p>
                <p><strong className="text-text">Diritti:</strong> accesso, rettifica, cancellazione, limitazione, portabilita, opposizione, revoca consenso, reclamo al Garante.</p>
              </div>
            </details>

            <div className="space-y-6">
              <div>
                <Checkbox
                  label="ACCONSENTO al trattamento dei dati personali per le finalita di cui al punto 1a (gestione associativa e tesseramento)."
                  {...register('gdpr_consent_1a')}
                  error={errors.gdpr_consent_1a?.message}
                />
                <div className="mt-4 ml-7">
                  <Controller
                    name="signature_gdpr_1a"
                    control={control}
                    render={({ field }) => (
                      <SignaturePad
                        label="Firma consenso punto 1a"
                        required
                        value={field.value}
                        onChange={(v) => field.onChange(v ?? '')}
                        error={errors.signature_gdpr_1a?.message}
                      />
                    )}
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-border">
                <Checkbox
                  label="ACCONSENTO al trattamento per le finalita di cui al punto 1b (comunicazioni promozionali sport CONI). Consenso facoltativo."
                  {...register('gdpr_consent_1b')}
                />
                <div className="mt-4 ml-7">
                  <Controller
                    name="signature_gdpr_1b"
                    control={control}
                    render={({ field }) => (
                      <SignaturePad
                        label="Firma consenso punto 1b (facoltativo)"
                        value={field.value || ''}
                        onChange={(v) => field.onChange(v ?? '')}
                      />
                    )}
                  />
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* SECTION 5: Safeguarding */}
        {section === 5 && (
          <Card
            title="Safeguarding"
            description="Tutela contro abusi, violenze e discriminazioni"
          >
            <div className="bg-bg-elevated rounded-md p-4 mb-6 text-sm space-y-2">
              <p>Il sottoscritto dichiara di aver visto e letto sul sito istituzionale del Circolo Altogarda Kite ASD:</p>
              <ul className="list-disc pl-6 text-text-muted space-y-1 mt-2">
                <li>Il Modello Organizzativo di Gestione e Controllo e il Codice di Condotta</li>
                <li>La modulistica per la segnalazione di abusi, violenze, discriminazioni (D.Lgs. 198/2006)</li>
                <li>I contatti del Responsabile Safeguarding</li>
              </ul>
              <p className="pt-3 mt-3 border-t border-border text-text-muted">
                <strong className="text-text">Responsabile Safeguarding:</strong> Loredana Santimaria<br />
                <strong className="text-text">Contatto:</strong> loredana.santimaria@gmail.com
              </p>
            </div>

            <Checkbox
              label="Dichiaro di aver preso visione del materiale safeguarding pubblicato sul sito istituzionale."
              {...register('safeguarding_acknowledged')}
              error={errors.safeguarding_acknowledged?.message}
            />

            <div className="mt-6">
              <Controller
                name="signature_safeguarding"
                control={control}
                render={({ field }) => (
                  <SignaturePad
                    label="Firma per presa visione safeguarding"
                    required
                    value={field.value}
                    onChange={(v) => field.onChange(v ?? '')}
                    error={errors.signature_safeguarding?.message}
                  />
                )}
              />
            </div>
          </Card>
        )}

        {/* SECTION 6: Conferma */}
        {section === 6 && (
          <Card title="Riepilogo e conferma">
            <div className="space-y-4 text-sm">
              <div>
                <div className="text-xs uppercase tracking-widest text-text-dim mb-1">Richiedente</div>
                <div className="font-medium">
                  {watch('first_name')} {watch('last_name')}
                </div>
                <div className="text-text-muted text-xs mt-0.5">
                  {watch('email')} • {watch('phone')}
                </div>
              </div>

              {isMinorWatch && (
                <div>
                  <div className="text-xs uppercase tracking-widest text-text-dim mb-1">Genitore</div>
                  <div className="font-medium">
                    {watch('parent_first_name')} {watch('parent_last_name')}
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs uppercase tracking-widest text-text-dim mb-2">Dichiarazioni e firme</div>
                <ul className="space-y-1 text-text-muted text-xs">
                  <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Statuto, certificato medico, impegno pagamento</li>
                  <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Informativa navigazione lago di Garda</li>
                  <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Consenso GDPR finalita istituzionali</li>
                  {watch('gdpr_consent_1b') && <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Consenso GDPR comunicazioni CONI</li>}
                  <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Safeguarding</li>
                </ul>
              </div>

              {serverError && (
                <div className="bg-danger/10 border border-danger/30 text-danger px-4 py-3 rounded-md text-sm">
                  {serverError}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between gap-3 sticky bottom-0 lg:bottom-auto bg-bg/95 backdrop-blur p-4 -mx-4 lg:mx-0 lg:p-0 lg:bg-transparent border-t border-border lg:border-0">
          <Button
            type="button"
            variant="ghost"
            onClick={goBack}
            disabled={section === 1 || submitting}
          >
            Indietro
          </Button>

          {section < 6 ? (
            <Button type="button" onClick={goNext}>
              Avanti
            </Button>
          ) : (
            <Button type="submit" disabled={submitting} size="lg">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Registrazione...
                </>
              ) : (
                'Registra socio'
              )}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
