import { z } from 'zod';

// ============================================================================
// Schema validazione Member (versione snella - dati essenziali, no firme)
// Le firme avvengono su carta, qui registriamo solo dati anagrafici
// + tipo associativo + certificato medico
// ============================================================================

export const memberSchema = z.object({
  // SOLO nome e cognome obbligatori - tutto il resto opzionale
  first_name: z.string().min(1, 'Nome obbligatorio').max(100),
  last_name: z.string().min(1, 'Cognome obbligatorio').max(100),
  birth_date: z.string().optional().or(z.literal('')),
  birth_place: z.string().optional().or(z.literal('')),
  birth_province: z.string().max(2).optional().or(z.literal('')),

  // Stranieri (codice fiscale opzionale)
  is_foreign: z.boolean().default(false),
  fiscal_code: z.string().optional().or(z.literal('')),
  foreign_id_doc: z.string().optional().or(z.literal('')),

  // Contatti (opzionali; se presenti devono essere validi)
  phone: z.string().optional().or(z.literal('')),
  email: z.string().email('Email non valida').optional().or(z.literal('')),

  // Indirizzo (campo libero singolo, opzionale)
  address: z.string().optional().or(z.literal('')),

  // Minore
  is_minor: z.boolean().default(false),
  parent_first_name: z.string().optional().or(z.literal('')),
  parent_last_name: z.string().optional().or(z.literal('')),
  parent_phone: z.string().optional().or(z.literal('')),
  parent_email: z.string().email().optional().or(z.literal('')),

  // Tipo associativo e quota
  member_type: z.enum(['sostenitore', 'normale', 'con_lift']),
  membership_paid_now: z.boolean().default(true),
  membership_payment_method: z.enum(['contanti', 'bancomat', 'bonifico', 'altro']).default('contanti'),

  // Certificato medico
  medical_cert_received: z.boolean().default(false),
  medical_cert_expires_at: z.string().optional().or(z.literal('')),

  // Note
  notes: z.string().optional().or(z.literal('')),
}).superRefine((data, ctx) => {
  // CF: se presente, deve avere formato valido (non piu obbligatorio)
  if (data.fiscal_code && data.fiscal_code.trim() !== ''
      && !/^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/i.test(data.fiscal_code.trim())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Codice fiscale non valido',
      path: ['fiscal_code'],
    });
  }

  // Certificato: se marcato "ricevuto", la data scadenza e' obbligatoria
  if (data.medical_cert_received && !data.medical_cert_expires_at) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Inserisci la data di scadenza del certificato',
      path: ['medical_cert_expires_at'],
    });
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
