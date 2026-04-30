import { z } from 'zod';

// ============================================================================
// Schema validazione Member (domanda ammissione socio)
// ============================================================================
export const memberSchema = z.object({
  // Anagrafica principale
  first_name: z.string().min(1, 'Nome obbligatorio').max(100),
  last_name: z.string().min(1, 'Cognome obbligatorio').max(100),
  birth_date: z.string().min(1, 'Data nascita obbligatoria'),
  birth_place: z.string().min(1, 'Luogo nascita obbligatorio'),
  birth_province: z.string().max(2).optional().or(z.literal('')),
  fiscal_code: z.string().min(1, 'Codice fiscale obbligatorio')
    .regex(/^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/i, 'Codice fiscale non valido'),
  phone: z.string().min(1, 'Cellulare obbligatorio'),
  email: z.string().email('Email non valida'),

  // Residenza
  address_street: z.string().min(1, 'Via obbligatoria'),
  address_number: z.string().min(1, 'Civico obbligatorio'),
  city: z.string().min(1, 'Citta obbligatoria'),
  cap: z.string().regex(/^\d{5}$/, 'CAP non valido'),

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

  // Dichiarazioni
  statute_accepted: z.literal(true, {
    errorMap: () => ({ message: 'Accettazione statuto obbligatoria' }),
  }),
  medical_certificate: z.literal(true, {
    errorMap: () => ({ message: 'Certificato medico obbligatorio' }),
  }),
  payment_commitment: z.literal(true, {
    errorMap: () => ({ message: 'Impegno pagamento obbligatorio' }),
  }),
  photo_authorization: z.boolean(),
  navigation_rules_accepted: z.literal(true, {
    errorMap: () => ({ message: 'Accettazione regole navigazione obbligatoria' }),
  }),
  safeguarding_acknowledged: z.literal(true, {
    errorMap: () => ({ message: 'Presa visione safeguarding obbligatoria' }),
  }),

  // GDPR
  gdpr_consent_1a: z.literal(true, {
    errorMap: () => ({ message: 'Consenso GDPR finalita istituzionali obbligatorio' }),
  }),
  gdpr_consent_1b: z.boolean(),

  // Firme - obbligatorie
  signature_admission: z.string().min(100, 'Firma domanda ammissione obbligatoria'),
  signature_navigation: z.string().min(100, 'Firma informativa navigazione obbligatoria'),
  signature_safeguarding: z.string().min(100, 'Firma safeguarding obbligatoria'),
  signature_gdpr_1a: z.string().min(100, 'Firma consenso GDPR 1a obbligatoria'),
  signature_gdpr_1b: z.string().optional().or(z.literal('')),

  notes: z.string().optional().or(z.literal('')),
}).refine(
  (data) => {
    // Se minore, dati genitore obbligatori
    if (data.is_minor) {
      return !!(
        data.parent_first_name &&
        data.parent_last_name &&
        data.parent_fiscal_code &&
        data.parent_phone
      );
    }
    return true;
  },
  {
    message: 'Per i minori sono obbligatori i dati del genitore esercente la potesta',
    path: ['parent_first_name'],
  }
);

export type MemberFormData = z.infer<typeof memberSchema>;

// ============================================================================
// Schema validazione Outing
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
