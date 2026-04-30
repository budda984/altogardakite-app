// ============================================================================
// Tipi TypeScript per il database AGK
// ============================================================================
// Per generare automaticamente questi tipi dal DB:
//   npx supabase gen types typescript --project-id <ID> > src/lib/database.types.ts
// ============================================================================

export type BoatType = 'nuova_jolly' | 'lomac' | 'pontoon';
export type WindSession = 'peler' | 'ora' | 'ora_serale';
export type InstructorRole = 'istruttore' | 'assistente' | 'direttore';
export type EquipmentType =
  | 'kite' | 'tavola' | 'barra' | 'trapezio' | 'muta'
  | 'giubbotto' | 'casco' | 'wing' | 'foil' | 'sup' | 'altro';
export type EquipmentStatus = 'disponibile' | 'in_uso' | 'manutenzione' | 'dismesso';
export type CourseType = 'base' | 'avanzato' | 'wing_foil' | 'privato' | 'altro';
export type CourseStatus = 'attivo' | 'completato' | 'sospeso' | 'annullato';
export type ParticipationType = 'corso' | 'lift_supervisionato' | 'lift_semplice';
export type RentalType =
  | 'nessuno' | 'completo' | 'solo_tavola' | 'solo_kite'
  | 'solo_barra' | 'solo_trapezio' | 'solo_muta'
  | 'solo_giubbotto' | 'wing_completo' | 'altro';

export interface Member {
  id: string;
  membership_number: number;
  first_name: string;
  last_name: string;
  birth_date: string;
  birth_place: string;
  birth_province: string | null;
  fiscal_code: string | null;
  phone: string | null;
  email: string | null;
  address_street: string | null;
  address_number: string | null;
  city: string | null;
  cap: string | null;
  is_minor: boolean;
  parent_first_name: string | null;
  parent_last_name: string | null;
  parent_birth_date: string | null;
  parent_birth_place: string | null;
  parent_fiscal_code: string | null;
  parent_address_street: string | null;
  parent_address_number: string | null;
  parent_city: string | null;
  parent_cap: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  statute_accepted: boolean;
  medical_certificate: boolean;
  payment_commitment: boolean;
  photo_authorization: boolean;
  navigation_rules_accepted: boolean;
  safeguarding_acknowledged: boolean;
  gdpr_consent_1a: boolean;
  gdpr_consent_1b: boolean;
  signature_admission: string | null;
  signature_navigation: string | null;
  signature_safeguarding: string | null;
  signature_gdpr_1a: string | null;
  signature_gdpr_1b: string | null;
  medical_certificate_url: string | null;
  identity_document_url: string | null;
  active: boolean;
  notes: string | null;
  registered_at: string;
  created_at: string;
  updated_at: string;
}

export interface Instructor {
  id: string;
  first_name: string;
  last_name: string;
  role: InstructorRole;
  fiv_certified: boolean;
  certifications: string[] | null;
  phone: string | null;
  email: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Boat {
  id: string;
  name: string;
  boat_type: BoatType;
  registration: string | null;
  capacity: number | null;
  active: boolean;
  notes: string | null;
  created_at: string;
}

export interface Equipment {
  id: string;
  code: string;
  equipment_type: EquipmentType;
  brand: string | null;
  model: string | null;
  size: string | null;
  year: number | null;
  serial_number: string | null;
  status: EquipmentStatus;
  purchase_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  member_id: string;
  course_type: CourseType;
  status: CourseStatus;
  start_date: string;
  end_date: string | null;
  hours_total: number;
  hours_completed: number;
  price: number | null;
  paid: boolean;
  payment_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Outing {
  id: string;
  outing_date: string;
  boat_id: string;
  departure_time: string | null;
  return_time: string | null;
  wind_session: WindSession | null;
  weather_notes: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OutingParticipant {
  id: string;
  outing_id: string;
  member_id: string;
  participation_type: ParticipationType;
  course_id: string | null;
  rental_type: RentalType;
  rental_price: number | null;
  notes: string | null;
  created_at: string;
}

export interface OutingWithDetails extends Outing {
  boat_name: string;
  boat_type: BoatType;
  participants_count: number;
  instructors_count: number;
}

// Etichette in italiano per UI
export const BOAT_LABELS: Record<BoatType, string> = {
  nuova_jolly: 'Nuova Jolly',
  lomac: 'Lomac',
  pontoon: 'Pontoon',
};

export const WIND_SESSION_LABELS: Record<WindSession, string> = {
  peler: 'Peler (mattina)',
  ora: 'Ora (pomeriggio)',
  ora_serale: 'Ora / Serale',
};

export const PARTICIPATION_LABELS: Record<ParticipationType, string> = {
  corso: 'Corso',
  lift_supervisionato: 'Lift supervisionato',
  lift_semplice: 'Lift semplice',
};

export const RENTAL_LABELS: Record<RentalType, string> = {
  nessuno: 'Nessun noleggio',
  completo: 'Noleggio completo',
  solo_tavola: 'Solo tavola',
  solo_kite: 'Solo kite',
  solo_barra: 'Solo barra',
  solo_trapezio: 'Solo trapezio',
  solo_muta: 'Solo muta',
  solo_giubbotto: 'Solo giubbotto',
  wing_completo: 'Wing completo',
  altro: 'Altro',
};

export const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  kite: 'Kite',
  tavola: 'Tavola',
  barra: 'Barra',
  trapezio: 'Trapezio',
  muta: 'Muta',
  giubbotto: 'Giubbotto',
  casco: 'Casco',
  wing: 'Wing',
  foil: 'Foil',
  sup: 'SUP',
  altro: 'Altro',
};

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  disponibile: 'Disponibile',
  in_uso: 'In uso',
  manutenzione: 'Manutenzione',
  dismesso: 'Dismesso',
};

export const COURSE_LABELS: Record<CourseType, string> = {
  base: 'Corso Base',
  avanzato: 'Corso Avanzato',
  wing_foil: 'Wing Foil',
  privato: 'Lezione Privata',
  altro: 'Altro',
};

export const INSTRUCTOR_ROLE_LABELS: Record<InstructorRole, string> = {
  istruttore: 'Istruttore',
  assistente: 'Assistente',
  direttore: 'Direttore',
};

export const COURSE_STATUS_LABELS: Record<CourseStatus, string> = {
  attivo: 'Attivo',
  completato: 'Completato',
  sospeso: 'Sospeso',
  annullato: 'Annullato',
};
