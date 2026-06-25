import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { outingSchema } from '@/lib/validation/schemas';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = outingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validazione fallita', issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { participants, instructor_ids, ...outingData } = parsed.data;

    // 1. Crea uscita
    const { data: outing, error: outingErr } = await supabase
      .from('outings')
      .insert({
        outing_date: outingData.outing_date,
        boat_id: outingData.boat_id,
        departure_time: outingData.departure_time || null,
        return_time: outingData.return_time || null,
        wind_session: outingData.wind_session || null,
        weather_notes: outingData.weather_notes || null,
        notes: outingData.notes || null,
      })
      .select('id')
      .single();

    if (outingErr || !outing) {
      console.error('Errore inserimento uscita:', outingErr);
      return NextResponse.json({ error: outingErr?.message ?? 'errore' }, { status: 500 });
    }

    // 2. Istruttori
    if (instructor_ids.length > 0) {
      const { error } = await supabase
        .from('outing_instructors')
        .insert(instructor_ids.map((id) => ({ outing_id: outing.id, instructor_id: id })));
      if (error) {
        console.error('Errore istruttori:', error);
      }
    }

    // 3. Partecipanti + attrezzature
    for (const p of participants) {
      const { data: pRow, error: pErr } = await supabase
        .from('outing_participants')
        .insert({
          outing_id: outing.id,
          member_id: p.member_id,
          participation_type: p.participation_type,
          course_id: p.course_id || null,
          rental_type: p.rental_type,
          rental_price: p.rental_price || null,
          notes: p.notes || null,
        })
        .select('id')
        .single();

      if (pErr || !pRow) {
        console.error('Errore partecipante:', pErr);
        continue;
      }

      if (p.equipment_ids && p.equipment_ids.length > 0) {
        await supabase.from('outing_participant_equipment').insert(
          p.equipment_ids.map((eid) => ({
            outing_participant_id: pRow.id,
            equipment_id: eid,
          }))
        );
      }
    }

    return NextResponse.json({ id: outing.id });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message ?? 'Errore' }, { status: 500 });
  }
}
