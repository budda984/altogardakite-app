import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get('date');
    if (!date) {
      return NextResponse.json({ error: 'date richiesto' }, { status: 400 });
    }

    const supabase = await createClient();

    // Templates attivi (in ordine)
    const templatesPromise = supabase
      .from('session_templates')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    // Uscite del giorno con barca, istruttori e partecipanti
    const outingsPromise = supabase
      .from('outings')
      .select(`
        id, code, outing_date, boat_id, session_template_id, discipline, wind_session,
        departure_time, return_time, weather_notes, notes,
        status, closed_at, cancelled_at, cancellation_reason,
        boat:boats(id, name, boat_type, capacity),
        outing_instructors(instructor_id, role, instructor:instructors(id, first_name, last_name, role)),
        outing_participants(
          id, participation_type, rental_type,
          member:members(id, first_name, last_name, membership_number)
        )
      `)
      .eq('outing_date', date)
      .order('departure_time', { ascending: true, nullsFirst: false });

    const [{ data: templates }, { data: outings, error: outingsErr }] = await Promise.all([
      templatesPromise,
      outingsPromise,
    ]);

    if (outingsErr) {
      return NextResponse.json({ error: outingsErr.message }, { status: 500 });
    }

    return NextResponse.json({
      date,
      templates: templates || [],
      outings: outings || [],
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}
