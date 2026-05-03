import { z } from 'zod';

// ============================================================================
// Schema validazione Member (domanda ammissione socio)
//
// IMPORTANTE: la validazione delle dichiarazioni e firme avviene SOLO
// all'invio finale del form (sezione 6 -> Conferma) tramite handleSubmit.
// Durante il flusso step-by-step la validazione e' gestita manualmente con
// trigger() su un sottoinsieme di campi della sezione corrente.
// Per questo lo schema base non blocca i campi se non spuntati: e' la
// onSubmit logic della pagina che richiede tutto coerente.
// ============================================================================

export const memberSchema = z.object({
  // Anagrafica principale
  first_name: z.string().min(1, 'Nome obbligatorio').max(100),
  last_name: z.string().min(1, 'Cognome obbligatorio').max(100),
  birth_date: z.string().min(1, 'Data nascita obbligatoria'),
  birth_place: z.string().min(1, 'Luogo nascita obbligatorio'),
  birth_province: z.string().max(2).optional().or(z.literal('')),

  // Stranieri: niente codice fiscale italiano richiesto
  is_foreign: z.boolean().default(false),
  fiscal_code: z.string().optional().or(z.literal('')),
  foreign_id_doc: z.string().optional().or(z.literal('')),

  phone: z.string().min(1, 'Cellulare obbligatorio'),
  email: z.string().email('Email non valida'),

  // Residenza
  address_street: z.string().min(1, 'Via obbligatoria'),
  address_number: z.string().min(1, 'Civico obbligatorio'),
  city: z.string().min(1, 'Citta obbligatoria'),
  cap: z.string().min(1, 'CAP obbligatorio'),

  // Modulo cartaceo gia firmato (salta firme digitali)
  paper_form_signed: z.boolean().default(false),

  // Minore
  is_minor: z.boolean(),
  parent_first_name: z.string().optional().or(z.literal('')),
  parent_last_name: z.string().optional().or(z.literal('')),
  parent_birth_date: z.string().optional().or(z.literal('')),
  parent_birth_place: z.string().optional().or(z.literal('')),
  parent_fiscal_code: z.string().optional().or(z.literal('')),
  parent_address_street: z.string().optional().or(z.literal('')),
  parent_address_number: z.string().optional().or(z.literal('')),
  parent_city: z.string().optional().or(z.literal('')),
  parent_cap: z.string().optional().or(z.literal('')),
  parent_phone: z.string().optional().or(z.literal('')),
  parent_email: z.string().email().optional().or(z.literal('')),

  // Dichiarazioni: tipi base, validazione condizionale via superRefine sotto
  statute_accepted: z.boolean(),
  medical_certificate: z.boolean(),
  payment_commitment: z.boolean(),
  photo_authorization: z.boolean(),
  navigation_rules_accepted: z.boolean(),
  safeguarding_acknowledged: z.boolean(),
  gdpr_consent_1a: z.boolean(),
  gdpr_consent_1b: z.boolean(),

  // Firme - tipi base, validazione condizionale via superRefine sotto
  signature_admission: z.string().optional().or(z.literal('')),
  signature_navigation: z.string().optional().or(z.literal('')),
  signature_safeguarding: z.string().optional().or(z.literal('')),
  signature_gdpr_1a: z.string().optional().or(z.literal('')),
  signature_gdpr_1b: z.string().optional().or(z.literal('')),

  notes: z.string().optional().or(z.literal('')),
}).superRefine((data, ctx) => {
  // Validazione codice fiscale: obbligatorio per italiani, formato CF
  if (!data.is_foreign) {
    if (!data.fiscal_code || data.fiscal_code.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Codice fiscale obbligatorio',
        path: ['fiscal_code'],
      });
    } else if (!/^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/i.test(data.fiscal_code.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Codice fiscale non valido',
        path: ['fiscal_code'],
      });
    }
  }
  // Stranieri: numero documento (passaporto/ID) consigliato ma non obbligatorio

  // CAP italiani: 5 cifre
  if (!data.is_foreign && data.cap && !/^\d{5}$/.test(data.cap)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'CAP non valido (5 cifre)',
      path: ['cap'],
    });
  }

  // Minore: dati genitore obbligatori
  if (data.is_minor) {
    if (!data.parent_first_name || !data.parent_last_name ||
        !data.parent_phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Per i minori sono obbligatori nome, cognome e telefono del genitore',
        path: ['parent_first_name'],
      });
    }
  }

  // Dichiarazioni e firme: SOLO se NON cartaceo
  if (!data.paper_form_signed) {
    const declarations: { field: keyof typeof data; label: string }[] = [
      { field: 'statute_accepted', label: 'Statuto' },
      { field: 'medical_certificate', label: 'Certificato medico' },
      { field: 'payment_commitment', label: 'Impegno pagamento' },
      { field: 'navigation_rules_accepted', label: 'Regole navigazione' },
      { field: 'safeguarding_acknowledged', label: 'Safeguarding' },
      { field: 'gdpr_consent_1a', label: 'GDPR consenso' },
    ];
    for (const d of declarations) {
      if (!data[d.field]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Spunta obbligatoria: ${d.label}`,
          path: [d.field],
        });
      }
    }

    const signatures: (keyof typeof data)[] = [
      'signature_admission', 'signature_navigation',
      'signature_safeguarding', 'signature_gdpr_1a',
    ];
    for (const s of signatures) {
      const v = data[s] as string | undefined;
      if (!v || v.length < 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Firma obbligatoria`,
          path: [s],
        });
      }
    }
  }
});

export type MemberFormData = z.infer<typeof memberSchema>;

// ============================================================================
// Schema validazione Outing (legacy - tenuto per compatibilita)
// ============================================================================
export const outingParticipantSchema = z.object({
  member_id: z.string().uuid('Socio obbligatorio'),
  participation_type: z.enum(['corso', 'lift_supervisionato', 'lift_semplice']),
  course_id: z.string().uuid().nullable().optional(),
  rental_type: z.enum([
    'nessuno', 'completo', 'solo_tavola', 'solo_kite', 'solo_barra',
    'solo_trapezio', 'solo_muta', 'solo_giubbotto', 'wing_completo', 'altro'
  ]),
  rental_price: z.number().min(0).nullable().optional(),
  equipment_ids: z.array(z.string().uuid()).default([]),
  notes: z.string().optional().or(z.literal('')),
});

export const outingSchema = z.object({
  outing_date: z.string().min(1, 'Data obbligatoria'),
  boat_id: z.string().uuid('Imbarcazione obbligatoria'),
  departure_time: z.string().optional().or(z.literal('')),
  return_time: z.string().optional().or(z.literal('')),
  wind_session: z.enum(['peler', 'ora', 'ora_serale']).optional().nullable(),
  weather_notes: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  instructor_ids: z.array(z.string().uuid()).min(1, 'Almeno un istruttore obbligatorio'),
  participants: z.array(outingParticipantSchema).min(1, 'Almeno un partecipante'),
});

export type OutingFormData = z.infer<typeof outingSchema>;
export type OutingParticipantFormData = z.infer<typeof outingParticipantSchema>;
