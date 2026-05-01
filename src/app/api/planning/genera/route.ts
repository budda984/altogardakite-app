import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth?.isStaff) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const body = await request.json();
    const date = body.date;
    const boatId = body.boat_id; // barca su cui generare le sessioni
    if (!date) return NextResponse.json({ error: 'date richiesto' }, { status: 400 });
    if (!boatId) return NextResponse.json({ error: 'boat_id richiesto' }, { status: 400 });

    const supabase = await createClient();

    // Templates di default
    const { data: templates } = await supabase
      .from('session_templates')
      .select('*')
      .eq('is_active', true)
      .eq('is_default', true)
      .order('sort_order');

    if (!templates || templates.length === 0) {
      return NextResponse.json({ error: 'Nessun template di default attivo' }, { status: 400 });
    }

    // Per ogni template, controlla se esiste gia un'uscita su quella barca / data / template,
    // altrimenti la crea
    const created: unknown[] = [];
    for (const t of templates) {
      const { data: existing } = await supabase
        .from('outings')
        .select('id')
        .eq('outing_date', date)
        .eq('boat_id', boatId)
        .eq('session_template_id', t.id)
        .maybeSingle();

      if (existing) continue;

      const { data: outing, error } = await supabase
        .from('outings')
        .insert({
          outing_date: date,
          boat_id: boatId,
          session_template_id: t.id,
          discipline: t.discipline,
          wind_session: t.wind_session,
          departure_time: t.default_departure_time,
          return_time: t.default_return_time,
          created_by: auth.userId,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      created.push(outing);
    }

    return NextResponse.json({ created_count: created.length, created }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}
