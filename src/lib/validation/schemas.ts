import { z } from 'zod';

// Helper: consenso obbligatorio (deve essere true) ma tipo TS = boolean
const requiredConsent = (message: string) =>
  z.boolean().refine((v) => v === true, { message });

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

  // Dichiarazioni (auto-true se paper_form_signed)
  statute_accepted: z.boolean(),
  medical_certificate: z.boolean(),
  payment_commitment: z.boolean(),
  photo_authorization: z.boolean(),
  navigation_rules_accepted: z.boolean(),
  safeguarding_acknowledged: z.boolean(),

  // GDPR
  gdpr_consent_1a: z.boolean(),
  gdpr_consent_1b: z.boolean(),

  // Firme - obbligatorie SOLO se non paper_form_signed
  signature_admission: z.string().optional().or(z.literal('')),
  signature_navigation: z.string().optional().or(z.literal('')),
  signature_safeguarding: z.string().optional().or(z.literal('')),
  signature_gdpr_1a: z.string().optional().or(z.literal('')),
  signature_gdpr_1b: z.string().optional().or(z.literal('')),

  notes: z.string().optional().or(z.literal('')),
}).refine(
  (data) => {
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
  { message: 'Per i minori sono obbligatori i dati del genitore esercente la potesta', path: ['parent_first_name'] }
).refine(
  (data) => {
    // Se NON cartaceo: tutte le dichiarazioni obbligatorie devono essere true
    if (!data.paper_form_signed) {
      return data.statute_accepted && data.medical_certificate &&
             data.payment_commitment && data.navigation_rules_accepted &&
             data.safeguarding_acknowledged && data.gdpr_consent_1a;
    }
    return true;
  },
  { message: 'Tutte le dichiarazioni obbligatorie vanno spuntate', path: ['statute_accepted'] }
).refine(
  (data) => {
    // Se NON cartaceo: firme obbligatorie
    if (!data.paper_form_signed) {
      return (data.signature_admission?.length || 0) > 100 &&
             (data.signature_navigation?.length || 0) > 100 &&
             (data.signature_safeguarding?.length || 0) > 100 &&
             (data.signature_gdpr_1a?.length || 0) > 100;
    }
    return true;
  },
  { message: 'Tutte le firme obbligatorie vanno apposte', path: ['signature_admission'] }
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
