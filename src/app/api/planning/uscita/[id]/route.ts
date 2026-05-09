import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';

const editOutingSchema = z.object({
  boat_id: z.string().uuid().optional(),
  departure_time: z.string().optional().or(z.literal('')),
  return_time: z.string().optional().or(z.literal('')),
  weather_notes: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  instructor_ids: z.array(z.string().uuid()).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: outingId } = await params;
    const auth = await getAuth();
    if (!auth?.isStaff) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = editOutingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const data = parsed.data;

    // Recupera lo stato corrente
    const { data: outing, error: outErr } = await supabase
      .from('outings')
      .select('id, status, boat_id')
      .eq('id', outingId)
      .single();

    if (outErr || !outing) {
      return NextResponse.json({ error: 'Uscita non trovata' }, { status: 404 });
    }

    if (outing.status === 'annullata') {
      return NextResponse.json(
        { error: 'Le uscite annullate non possono essere modificate' },
        { status: 409 }
      );
    }

    // Se l'uscita e' chiusa, NON si puo' cambiare la barca
    // (riapri prima)
    if (outing.status === 'chiusa' && data.boat_id && data.boat_id !== outing.boat_id) {
      return NextResponse.json(
        {
          error: 'Per cambiare imbarcazione su un\'uscita chiusa, riaprila prima.',
        },
        { status: 409 }
      );
    }

    // Aggiorna dati uscita
    const updatePayload: Record<string, unknown> = {};
    if (data.boat_id !== undefined) updatePayload.boat_id = data.boat_id;
    if (data.departure_time !== undefined) updatePayload.departure_time = data.departure_time || null;
    if (data.return_time !== undefined) updatePayload.return_time = data.return_time || null;
    if (data.weather_notes !== undefined) updatePayload.weather_notes = data.weather_notes || null;
    if (data.notes !== undefined) updatePayload.notes = data.notes || null;

    if (Object.keys(updatePayload).length > 0) {
      const { error: upErr } = await supabase
        .from('outings')
        .update(updatePayload)
        .eq('id', outingId);
      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }
    }

    // Se sono stati passati gli istruttori: rimpiazza la lista
    if (data.instructor_ids !== undefined) {
      // Cancella attuali
      await supabase.from('outing_instructors').delete().eq('outing_id', outingId);
      // Inserisci nuovi
      if (data.instructor_ids.length > 0) {
        const rows = data.instructor_ids.map((iid) => ({
          outing_id: outingId,
          instructor_id: iid,
        }));
        const { error: insErr } = await supabase.from('outing_instructors').insert(rows);
        if (insErr) {
          return NextResponse.json({ error: insErr.message }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}
