import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';
import { planningOutingSchema } from '@/lib/validation/admin-schemas';
import { logActivity } from '@/lib/activityLog';

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth?.isStaff) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = planningOutingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const data = parsed.data;

    // Crea outing
    const { data: outing, error } = await supabase
      .from('outings')
      .insert({
        outing_date: data.outing_date,
        boat_id: data.boat_id,
        session_template_id: data.session_template_id || null,
        discipline: data.discipline || null,
        wind_session: data.wind_session || null,
        departure_time: data.departure_time || null,
        return_time: data.return_time || null,
        weather_notes: data.weather_notes || null,
        notes: data.notes || null,
        created_by: auth.userId,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Aggiunge istruttori
    if (data.instructor_ids.length > 0) {
      const rows = data.instructor_ids.map((iid) => ({
        outing_id: outing.id,
        instructor_id: iid,
      }));
      await supabase.from('outing_instructors').insert(rows);
    }

    // Genera codice identificativo (dopo aver assegnato gli istruttori)
    let code: string | null = null;
    try {
      const { data: genCode } = await supabase.rpc('agk_genera_codice_uscita', {
        p_outing_id: outing.id,
      });
      code = genCode as string | null;
    } catch { /* non bloccante */ }

    const { data: boat } = await supabase
      .from('boats').select('name').eq('id', data.boat_id).single();
    await logActivity(supabase, auth, 'outing.create',
      `Uscita creata${code ? ` [${code}]` : ''}: ${boat?.name || 'barca'} il ${data.outing_date}`,
      { outing_id: outing.id, boat_id: data.boat_id, date: data.outing_date, code });

    return NextResponse.json({ ...outing, code }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}
