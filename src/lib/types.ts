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
  code: string | null;
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

// ============================================================================
// SERVICES (catalogo listino)
// ============================================================================
export type ServiceCategory =
  | 'lift_singolo'
  | 'lift_pacchetto'
  | 'lift_assistito'
  | 'iniziazione'
  | 'pacchetto_stagionale'
  | 'noleggio_attrezzatura'
  | 'wingfoil'
  | 'combo'
  | 'storage'
  | 'altro';

export type PaymentMethod = 'contanti' | 'bancomat' | 'bonifico' | 'altro';

export type EquipmentTransactionType =
  | 'acquisto' | 'vendita' | 'dismissione' | 'manutenzione' | 'cessione';

export interface Service {
  id: string;
  slug: string;
  name: string;
  category: ServiceCategory;
  unit_price: number;
  included_lifts: number;
  discipline: LiftDiscipline;
  is_subscription: boolean;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MemberService {
  id: string;
  member_id: string;
  service_id: string | null;
  service_name_snapshot: string;
  category: ServiceCategory | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  paid: boolean;
  payment_date: string | null;
  payment_method: PaymentMethod | null;
  outing_id: string | null;
  notes: string | null;
  sold_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EquipmentTransaction {
  id: string;
  equipment_id: string;
  transaction_type: EquipmentTransactionType;
  transaction_date: string;
  amount: number | null;
  member_id: string | null;
  buyer_name: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  lift_singolo: 'Lift singoli',
  lift_pacchetto: 'Pacchetti lift',
  lift_assistito: 'Lift assistiti',
  iniziazione: 'Corsi di iniziazione',
  pacchetto_stagionale: 'Pacchetti stagionali',
  noleggio_attrezzatura: 'Noleggio attrezzatura',
  wingfoil: 'Wingfoil',
  combo: 'Combo lift + attrezzatura',
  storage: 'Storage stagionale',
  altro: 'Altro',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  contanti: 'Contanti',
  bancomat: 'Bancomat / POS',
  bonifico: 'Bonifico',
  altro: 'Altro',
};

export const EQUIPMENT_TRANSACTION_LABELS: Record<EquipmentTransactionType, string> = {
  acquisto: 'Acquisto',
  vendita: 'Vendita',
  dismissione: 'Dismissione',
  manutenzione: 'Manutenzione',
  cessione: 'Cessione',
};

// ============================================================================
// PROFILES (utenti staff con ruoli)
// ============================================================================
// 'socio' arriva dalla migration 0025: e' chi usa il portale soci, non il
// gestionale. Qui non entra mai (isStaff resta false), ma il tipo deve dire
// la verita' su cosa puo' esserci dentro profiles.role.
export type UserRole = 'pending' | 'staff' | 'admin' | 'socio';

export interface Profile {
  id: string;
  role: UserRole;
  display_name: string | null;
  approved_at: string | null;
  approved_by: string | null;
  suspended: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProfileWithEmail extends Profile {
  email: string | null;
  last_sign_in_at: string | null;
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  pending: 'In attesa',
  staff: 'Staff',
  admin: 'Amministratore',
  socio: 'Socio (portale)',
};

// ============================================================================
// WALLET / PACKAGES / MOVEMENTS
// ============================================================================
export type LiftDiscipline = 'kite' | 'wingfoil' | 'sit_kite' | 'wingfoil_adattato' | 'corso' | 'altro';

export type MovementType =
  | 'acquisto_pacchetto'
  | 'pagamento'
  | 'consumo_lift'
  | 'addebito'
  | 'rimborso'
  | 'correzione';

export interface Package {
  id: string;
  member_id: string;
  service_id: string | null;
  service_name_snapshot: string;
  discipline: LiftDiscipline;
  lifts_total: number;
  lifts_used: number;
  total_price: number;
  is_exhausted: boolean;
  is_subscription: boolean;
  valid_from: string | null;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActiveSubscription {
  package_id: string;
  member_id: string;
  service_name_snapshot: string;
  discipline: LiftDiscipline;
  valid_from: string;
  valid_until: string;
  total_price: number;
  days_remaining: number;
}

export interface Movement {
  id: string;
  member_id: string;
  movement_type: MovementType;
  movement_date: string;
  description: string;
  amount: number;
  lift_delta: number;
  lift_discipline: LiftDiscipline | null;
  package_id: string | null;
  service_id: string | null;
  outing_id: string | null;
  paid: boolean;
  payment_method: PaymentMethod | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface MemberWallet {
  member_id: string;
  first_name: string;
  last_name: string;
  membership_number: number;
  total_outstanding: number;
  open_debts_count: number;
  total_received: number;
  movements_count: number;
}

export interface OpenDebt {
  movement_id: string;
  member_id: string;
  movement_date: string;
  description: string;
  amount_due: number;
  outing_id: string | null;
  participant_id: string | null;
  notes: string | null;
  outing_date: string | null;
  outing_discipline: LiftDiscipline | null;
  boat_name: string | null;
}

export interface LiftBalance {
  member_id: string;
  discipline: LiftDiscipline;
  lifts_remaining: number;
  lifts_total: number;
  packages_count: number;
  packages_active: number;
}

export const DISCIPLINE_LABELS: Record<LiftDiscipline, string> = {
  kite: 'Kite',
  wingfoil: 'Wingfoil',
  sit_kite: 'Sit\'n\'kite',
  wingfoil_adattato: 'Wingfoil adattato',
  corso: 'Corso',
  altro: 'Altro',
};

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  acquisto_pacchetto: 'Acquisto pacchetto',
  pagamento: 'Pagamento',
  consumo_lift: 'Consumo lift',
  addebito: 'Addebito',
  rimborso: 'Rimborso',
  correzione: 'Correzione',
};

// ============================================================================
// PLANNING / SESSION TEMPLATES
// ============================================================================
export interface SessionTemplate {
  id: string;
  name: string;
  discipline: LiftDiscipline;
  wind_session: WindSession | null;
  default_departure_time: string;  // HH:MM
  default_return_time: string;
  sort_order: number;
  is_default: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// MEMBER TYPE
// ============================================================================
export type MemberType = 'sostenitore' | 'normale' | 'con_lift';

export const MEMBER_TYPE_LABELS: Record<MemberType, string> = {
  sostenitore: 'Sostenitore',
  normale: 'Normale',
  con_lift: 'Con lift incluso',
};

export const MEMBER_TYPE_PRICES: Record<MemberType, number> = {
  sostenitore: 10,
  normale: 30,
  con_lift: 45,
};

export interface DashboardAlerts {
  memberships_expiring_soon: number;
  memberships_expired: number;
  medical_certs_expiring_soon: number;
  medical_certs_expired: number;
  members_missing_medical: number;
}

// ============================================================================
// OUTING STATUS
// ============================================================================
export type OutingStatus = 'bozza' | 'chiusa' | 'annullata';

export const OUTING_STATUS_LABELS: Record<OutingStatus, string> = {
  bozza: 'Bozza',
  chiusa: 'Chiusa',
  annullata: 'Annullata',
};

// ============================================================================
// BOOKINGS
// ============================================================================
export type BookingStatus = 'pending' | 'assigned' | 'cancelled';

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'In attesa',
  assigned: 'Assegnato',
  cancelled: 'Annullato',
};

export interface Booking {
  id: string;
  member_id: string;
  booking_date: string;
  session_template_id: string;
  preferred_discipline: LiftDiscipline | null;
  participation_type: ParticipationType;
  notes: string | null;
  status: BookingStatus;
  is_waitlist: boolean;
  outing_id: string | null;
  participant_id: string | null;
  created_at: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
}

export interface BookingWithMember extends Booking {
  first_name: string;
  last_name: string;
  membership_number: number;
  member_type: MemberType;
  phone: string | null;
  expires_at: string | null;
  medical_cert_received: boolean;
  medical_cert_expires_at: string | null;
  // Dalla migration 0031: distinguono le richieste del portale da approvare
  // dalle prenotazioni gia' lavorabili nel planner.
  source?: 'staff' | 'portale';
  accepted_at?: string | null;
  refused_at?: string | null;
  template_name: string;
  template_wind_session: string | null;
  default_departure_time: string;
  default_return_time: string;
  created_by_name: string | null;
}

// Vista bookings_da_rispondere (migration 0028, ampliata dalla 0030).
// Tutto quello che serve per rispondere a una richiesta in dieci secondi
// senza aprire la scheda del socio.
export interface RichiestaDaRispondere {
  id: string;
  booking_date: string;
  created_at: string;
  notes: string | null;
  is_waitlist: boolean;
  preferred_discipline: LiftDiscipline | null;
  member_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  membership_number: number | null;
  member_type: MemberType | null;
  tessera_scade_il: string | null;
  tessera_scaduta: boolean;
  certificato_scade_il: string | null;
  certificato_non_valido: boolean;
  template_name: string;
  wind_session: WindSession | null;
  default_departure_time: string | null;
  fascia: 'mattina' | 'pomeriggio';
  lift_residui: number | null;
  ha_abbonamento: boolean;
  capienza: number;
  posti_impegnati: number;
  posti_liberi: number;
  altre_richieste_sulla_fascia: number;
}
