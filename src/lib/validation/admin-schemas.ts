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
