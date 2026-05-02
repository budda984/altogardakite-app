import { z } from 'zod';

// ============================================================================
// INSTRUCTORS
// ============================================================================
export const instructorSchema = z.object({
  first_name: z.string().min(1, 'Nome obbligatorio').max(100),
  last_name: z.string().min(1, 'Cognome obbligatorio').max(100),
  role: z.enum(['istruttore', 'assistente', 'direttore']),
  fiv_certified: z.boolean().default(false),
  certifications: z.array(z.string()).default([]),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().email('Email non valida').optional().or(z.literal('')),
  active: z.boolean().default(true),
  notes: z.string().optional().or(z.literal('')),
});
export type InstructorFormData = z.infer<typeof instructorSchema>;

// ============================================================================
// BOATS
// ============================================================================
export const boatSchema = z.object({
  name: z.string().min(1, 'Nome obbligatorio').max(100),
  boat_type: z.enum(['nuova_jolly', 'lomac', 'pontoon']),
  registration: z.string().optional().or(z.literal('')),
  capacity: z.coerce.number().int().min(1).max(50).nullable().optional(),
  active: z.boolean().default(true),
  notes: z.string().optional().or(z.literal('')),
});
export type BoatFormData = z.infer<typeof boatSchema>;

// ============================================================================
// EQUIPMENT
// ============================================================================
export const equipmentSchema = z.object({
  code: z.string().min(1, 'Codice obbligatorio').max(50),
  equipment_type: z.enum([
    'kite', 'tavola', 'barra', 'trapezio', 'muta', 'giubbotto',
    'casco', 'wing', 'foil', 'sup', 'altro',
  ]),
  brand: z.string().optional().or(z.literal('')),
  model: z.string().optional().or(z.literal('')),
  size: z.string().optional().or(z.literal('')),
  year: z.coerce.number().int().min(1990).max(2100).nullable().optional(),
  serial_number: z.string().optional().or(z.literal('')),
  status: z.enum(['disponibile', 'in_uso', 'manutenzione', 'dismesso']).default('disponibile'),
  purchase_date: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});
export type EquipmentFormData = z.infer<typeof equipmentSchema>;

// ============================================================================
// COURSES
// ============================================================================
export const courseSchema = z.object({
  member_id: z.string().uuid('Socio obbligatorio'),
  course_type: z.enum(['base', 'avanzato', 'wing_foil', 'privato', 'altro']),
  status: z.enum(['attivo', 'completato', 'sospeso', 'annullato']).default('attivo'),
  start_date: z.string().min(1, 'Data inizio obbligatoria'),
  end_date: z.string().optional().or(z.literal('')),
  hours_total: z.coerce.number().min(0).max(1000).default(0),
  hours_completed: z.coerce.number().min(0).max(1000).default(0),
  price: z.coerce.number().min(0).nullable().optional(),
  paid: z.boolean().default(false),
  payment_date: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});
export type CourseFormData = z.infer<typeof courseSchema>;

// ============================================================================
// SERVICES (listino)
// ============================================================================
export const serviceSchema = z.object({
  slug: z.string().min(1, 'Slug obbligatorio').max(100)
    .regex(/^[a-z0-9_]+$/, 'Solo lettere minuscole, numeri e underscore'),
  name: z.string().min(1, 'Nome obbligatorio').max(200),
  category: z.enum([
    'lift_singolo', 'lift_pacchetto', 'lift_assistito',
    'iniziazione', 'pacchetto_stagionale', 'noleggio_attrezzatura',
    'wingfoil', 'combo', 'storage', 'altro',
  ]),
  unit_price: z.coerce.number().min(0, 'Prezzo non negativo'),
  included_lifts: z.coerce.number().int().min(0).default(0),
  is_subscription: z.boolean().default(false),
  description: z.string().optional().or(z.literal('')),
  is_active: z.boolean().default(true),
  sort_order: z.coerce.number().int().default(0),
});
export type ServiceFormData = z.infer<typeof serviceSchema>;

// ============================================================================
// MEMBER SERVICES (addebiti su socio)
// ============================================================================
export const memberServiceSchema = z.object({
  service_id: z.string().uuid('Servizio obbligatorio'),
  quantity: z.coerce.number().int().min(1).default(1),
  unit_price: z.coerce.number().min(0),
  paid: z.boolean().default(false),
  payment_date: z.string().optional().or(z.literal('')),
  payment_method: z.enum(['contanti', 'bancomat', 'bonifico', 'altro']).nullable().optional(),
  outing_id: z.string().uuid().nullable().optional(),
  notes: z.string().optional().or(z.literal('')),
});
export type MemberServiceFormData = z.infer<typeof memberServiceSchema>;

// Update di un addebito esistente (paid toggle, etc.)
export const memberServiceUpdateSchema = z.object({
  paid: z.boolean(),
  payment_date: z.string().optional().or(z.literal('')),
  payment_method: z.enum(['contanti', 'bancomat', 'bonifico', 'altro']).nullable().optional(),
  notes: z.string().optional().or(z.literal('')),
});
export type MemberServiceUpdateData = z.infer<typeof memberServiceUpdateSchema>;

// ============================================================================
// EQUIPMENT TRANSACTIONS
// ============================================================================
export const equipmentTransactionSchema = z.object({
  transaction_type: z.enum(['acquisto', 'vendita', 'dismissione', 'manutenzione', 'cessione']),
  transaction_date: z.string().min(1, 'Data obbligatoria'),
  amount: z.coerce.number().min(0).nullable().optional(),
  member_id: z.string().uuid().nullable().optional(),
  buyer_name: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});
export type EquipmentTransactionFormData = z.infer<typeof equipmentTransactionSchema>;

// ============================================================================
// WALLET: acquisto pacchetto
// ============================================================================
export const purchasePackageSchema = z.object({
  service_id: z.string().uuid('Servizio obbligatorio'),
  total_price: z.coerce.number().min(0),
  paid_now: z.boolean().default(true),
  payment_method: z.enum(['contanti', 'bancomat', 'bonifico', 'altro']).nullable().optional(),
  // Date di validita (solo per abbonamenti). Nullable: il backend le calcola.
  valid_from: z.string().optional().or(z.literal('')),
  valid_until: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});
export type PurchasePackageFormData = z.infer<typeof purchasePackageSchema>;

// ============================================================================
// WALLET: addebito singolo (servizio non da pacchetto)
// ============================================================================
export const chargeServiceSchema = z.object({
  service_id: z.string().uuid('Servizio obbligatorio'),
  quantity: z.coerce.number().int().min(1).default(1),
  unit_price: z.coerce.number().min(0),
  paid_now: z.boolean().default(false),
  payment_method: z.enum(['contanti', 'bancomat', 'bonifico', 'altro']).nullable().optional(),
  notes: z.string().optional().or(z.literal('')),
});
export type ChargeServiceFormData = z.infer<typeof chargeServiceSchema>;

// ============================================================================
// MEMBER EDIT (modifica anagrafica)
// ============================================================================
export const memberEditSchema = z.object({
  first_name: z.string().min(1, 'Nome obbligatorio').max(100),
  last_name: z.string().min(1, 'Cognome obbligatorio').max(100),
  email: z.string().email('Email non valida').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  address_street: z.string().optional().or(z.literal('')),
  address_number: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  cap: z.string().optional().or(z.literal('')),
  birth_province: z.string().optional().or(z.literal('')),
  fiscal_code: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});
export type MemberEditFormData = z.infer<typeof memberEditSchema>;

// ============================================================================
// WALLET: salda uno o piu' debiti specifici
// ============================================================================
export const settleDebtsSchema = z.object({
  movement_ids: z.array(z.string().uuid()).min(1, 'Seleziona almeno un debito'),
  payment_method: z.enum(['contanti', 'bancomat', 'bonifico', 'altro']),
  notes: z.string().optional().or(z.literal('')),
});
export type SettleDebtsFormData = z.infer<typeof settleDebtsSchema>;

// ============================================================================
// WALLET: consumo lift manuale (collegato a uscita)
// ============================================================================
export const consumeLiftSchema = z.object({
  discipline: z.enum(['kite', 'wingfoil', 'sit_kite', 'wingfoil_adattato', 'altro']),
  package_id: z.string().uuid().nullable().optional(),
  outing_id: z.string().uuid().nullable().optional(),
  notes: z.string().optional().or(z.literal('')),
});
export type ConsumeLiftFormData = z.infer<typeof consumeLiftSchema>;

// ============================================================================
// SESSION TEMPLATES
// ============================================================================
export const sessionTemplateSchema = z.object({
  name: z.string().min(1, 'Nome obbligatorio').max(100),
  discipline: z.enum(['kite', 'wingfoil', 'sit_kite', 'wingfoil_adattato', 'altro']),
  wind_session: z.enum(['peler', 'ora', 'ora_serale']).nullable().optional(),
  default_departure_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Formato HH:MM'),
  default_return_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Formato HH:MM'),
  sort_order: z.coerce.number().int().default(0),
  is_default: z.boolean().default(true),
  is_active: z.boolean().default(true),
  notes: z.string().optional().or(z.literal('')),
});
export type SessionTemplateFormData = z.infer<typeof sessionTemplateSchema>;

// ============================================================================
// PLANNING: crea/aggiungi barca a sessione
// ============================================================================
export const planningOutingSchema = z.object({
  outing_date: z.string().min(1, 'Data obbligatoria'),
  session_template_id: z.string().uuid().nullable().optional(),
  boat_id: z.string().uuid('Imbarcazione obbligatoria'),
  departure_time: z.string().optional().or(z.literal('')),
  return_time: z.string().optional().or(z.literal('')),
  discipline: z.enum(['kite', 'wingfoil', 'sit_kite', 'wingfoil_adattato', 'altro']).optional(),
  wind_session: z.enum(['peler', 'ora', 'ora_serale']).nullable().optional(),
  weather_notes: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  instructor_ids: z.array(z.string().uuid()).default([]),
});
export type PlanningOutingFormData = z.infer<typeof planningOutingSchema>;

// ============================================================================
// PLANNING: aggiungi partecipante a uscita
// ============================================================================
export const planningParticipantSchema = z.object({
  member_id: z.string().uuid('Socio obbligatorio'),
  participation_type: z.enum(['corso', 'lift_supervisionato', 'lift_semplice']).default('lift_semplice'),
  rental_type: z.enum([
    'nessuno', 'completo', 'solo_tavola', 'solo_kite', 'solo_barra',
    'solo_trapezio', 'solo_muta', 'solo_giubbotto', 'wing_completo', 'altro',
  ]).default('nessuno'),
  // gestione credito: se "consume_package" usa il pacchetto suggerito (FIFO)
  // se "charge" addebita il prezzo del lift singolo
  // se "no_charge" non fa nulla (solo registra la presenza)
  billing_mode: z.enum([
    'consume_package', 'charge_unpaid', 'charge_paid', 'no_charge', 'covered_by_subscription'
  ]).default('no_charge'),
  package_id: z.string().uuid().nullable().optional(),
  charge_amount: z.coerce.number().min(0).nullable().optional(),
  payment_method: z.enum(['contanti', 'bancomat', 'bonifico', 'altro']).nullable().optional(),
  notes: z.string().optional().or(z.literal('')),
});
export type PlanningParticipantFormData = z.infer<typeof planningParticipantSchema>;
