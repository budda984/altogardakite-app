import { z } from 'zod';

export const createBookingSchema = z.object({
  member_id: z.string().uuid(),
  booking_date: z.string().min(1),
  session_template_id: z.string().uuid(),
  preferred_discipline: z.enum(['kite', 'wingfoil', 'sit_kite', 'wingfoil_adattato', 'corso', 'altro']).optional().nullable(),
  notes: z.string().optional().or(z.literal('')),
});
export type CreateBookingFormData = z.infer<typeof createBookingSchema>;

export const createOutingFromBookingsSchema = z.object({
  booking_ids: z.array(z.string().uuid()).min(1, 'Almeno una prenotazione'),
  outing_date: z.string().min(1),
  session_template_id: z.string().uuid(),
  boat_id: z.string().uuid('Barca obbligatoria'),
  discipline: z.enum(['kite', 'wingfoil', 'sit_kite', 'wingfoil_adattato', 'corso', 'altro']),
  departure_time: z.string().optional().or(z.literal('')),
  return_time: z.string().optional().or(z.literal('')),
  wind_session: z.enum(['peler', 'ora', 'ora_serale']).optional().nullable(),
  weather_notes: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  instructor_ids: z.array(z.string().uuid()),
});
export type CreateOutingFromBookingsFormData = z.infer<typeof createOutingFromBookingsSchema>;
