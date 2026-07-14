import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';
import { createOutingFromBookingsSchema } from '@/lib/validation/booking-schemas';

/**
 * POST /api/bookings/crea-uscita
 * Crea un'uscita da un gruppo di prenotazioni pending dello stesso slot.
 * Le prenotazioni vengono marcate 'assigned' e linkate all'outing/participant.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth?.isStaff) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createOutingFromBookingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const supabase = await createClient();

    const { data: outingId, error } = await supabase.rpc('create_outing_from_bookings', {
      p_booking_ids: data.booking_ids,
      p_boat_id: data.boat_id,
      p_outing_date: data.outing_date,
      p_session_template_id: data.session_template_id,
      p_discipline: data.discipline,
      p_departure_time: data.departure_time || null,
      p_return_time: data.return_time || null,
      p_wind_session: data.wind_session || null,
      p_weather_notes: data.weather_notes || null,
      p_notes: data.notes || null,
      p_instructor_ids: data.instructor_ids,
      p_created_by: auth.userId,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Genera il codice identificativo (data-barca-istruttore-progressivo)
    let code: string | null = null;
    try {
      const { data: genCode } = await supabase.rpc('agk_genera_codice_uscita', {
        p_outing_id: outingId,
      });
      code = genCode as string | null;
    } catch {
      // non bloccante: se fallisce, l'uscita resta senza codice
    }

    // Log attivita
    const { data: boat } = await supabase
      .from('boats').select('name').eq('id', data.boat_id).single();
    await logActivity(supabase, auth, 'outing.create',
      `Uscita creata${code ? ` [${code}]` : ''} (bozza): ${boat?.name || 'barca'} il ${data.outing_date} con ${data.booking_ids.length} partecipanti`,
      { outing_id: outingId, boat_id: data.boat_id, date: data.outing_date, code });

    return NextResponse.json({
      outing_id: outingId,
      participants_count: data.booking_ids.length,
      code,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}
