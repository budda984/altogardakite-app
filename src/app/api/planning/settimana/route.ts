import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/planning/settimana?start=YYYY-MM-DD
 * Carica templates + prenotazioni + uscite per i 7 giorni a partire da `start`.
 */
export async function GET(request: NextRequest) {
  try {
    const start = request.nextUrl.searchParams.get('start');
    if (!start) {
      return NextResponse.json({ error: 'start richiesto' }, { status: 400 });
    }

    // Calcola fine range (start + 6 giorni)
    const startDate = new Date(start + 'T12:00:00');
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    const end = endDate.toISOString().slice(0, 10);

    const supabase = await createClient();

    const templatesPromise = supabase
      .from('session_templates')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    // Prenotazioni della settimana (dalla vista che include nome + telefono)
    const bookingsPromise = supabase
      .from('bookings_with_member')
      .select('*')
      .gte('booking_date', start)
      .lte('booking_date', end)
      .eq('status', 'pending')
      .eq('is_waitlist', false)
      .order('first_name', { ascending: true });

    // Uscite della settimana
    const outingsPromise = supabase
      .from('outings')
      .select(`
        id, outing_date, boat_id, session_template_id, discipline, wind_session,
        departure_time, return_time, status,
        boat:boats(id, name, capacity),
        outing_participants(
          id, participation_type,
          member:members(id, first_name, last_name)
        )
      `)
      .gte('outing_date', start)
      .lte('outing_date', end)
      .order('departure_time', { ascending: true, nullsFirst: false });

    const absencesPromise = supabase
      .from('instructor_absences')
      .select(`
        id, instructor_id, absence_date, session_template_id, notes,
        instructor:instructors(id, first_name, last_name)
      `)
      .gte('absence_date', start)
      .lte('absence_date', end);

    const [
      { data: templates },
      { data: bookings, error: bookingsErr },
      { data: outings, error: outingsErr },
      { data: absences },
    ] = await Promise.all([templatesPromise, bookingsPromise, outingsPromise, absencesPromise]);

    if (bookingsErr) {
      return NextResponse.json({ error: bookingsErr.message }, { status: 500 });
    }
    if (outingsErr) {
      return NextResponse.json({ error: outingsErr.message }, { status: 500 });
    }

    return NextResponse.json({
      start,
      end,
      templates: templates || [],
      bookings: bookings || [],
      outings: outings || [],
      absences: absences || [],
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}
