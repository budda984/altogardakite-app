import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';
import { z } from 'zod';

const updateParticipantSchema = z.object({
  participation_type: z.enum(['corso', 'lift_supervisionato', 'lift_semplice']).optional(),
  rental_type: z.enum([
    'nessuno', 'completo', 'solo_tavola', 'solo_kite', 'solo_barra',
    'solo_trapezio', 'solo_muta', 'solo_giubbotto', 'wing_completo', 'altro',
  ]).optional(),
  rental_charge_amount: z.coerce.number().min(0).nullable().optional(),
  notes: z.string().nullable().optional(),
});

/**
 * PATCH /api/planning/uscita/[id]/partecipanti/[pid]
 * Modifica un partecipante esistente. Possibile solo su uscite in stato BOZZA.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string }> }
) {
  try {
    const { id: outingId, pid: participantId } = await params;
    const auth = await getAuth();
    if (!auth?.isStaff) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateParticipantSchema.safeParse(body);
    if (!parsed.success) {
      const detailed = parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      return NextResponse.json(
        { error: `Dati non validi - ${detailed}`, issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verifica stato uscita: solo bozza modificabile
    const { data: outing, error: outErr } = await supabase
      .from('outings')
      .select('id, status')
      .eq('id', outingId)
      .single();
    if (outErr || !outing) {
      return NextResponse.json({ error: 'Uscita non trovata' }, { status: 404 });
    }
    if (outing.status !== 'bozza') {
      return NextResponse.json(
        { error: 'Per modificare i partecipanti l\'uscita deve essere in BOZZA. Riapri l\'uscita prima.' },
        { status: 409 }
      );
    }

    // Verifica che il participant appartenga effettivamente a questa uscita
    const { data: participant, error: pErr } = await supabase
      .from('outing_participants')
      .select('id, outing_id')
      .eq('id', participantId)
      .single();
    if (pErr || !participant) {
      return NextResponse.json({ error: 'Partecipante non trovato' }, { status: 404 });
    }
    if (participant.outing_id !== outingId) {
      return NextResponse.json(
        { error: 'Il partecipante non appartiene a questa uscita' },
        { status: 400 }
      );
    }

    // Costruisci update solo coi campi forniti
    const update: Record<string, unknown> = {};
    if (parsed.data.participation_type !== undefined) update.participation_type = parsed.data.participation_type;
    if (parsed.data.rental_type !== undefined) update.rental_type = parsed.data.rental_type;
    if (parsed.data.rental_charge_amount !== undefined) update.rental_charge_amount = parsed.data.rental_charge_amount;
    if (parsed.data.notes !== undefined) update.notes = parsed.data.notes || null;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nessun campo da aggiornare' }, { status: 400 });
    }

    const { data: updated, error: updErr } = await supabase
      .from('outing_participants')
      .update(update)
      .eq('id', participantId)
      .select()
      .single();

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, participant: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/planning/uscita/[id]/partecipanti/[pid]
 * Rimuove un partecipante. Possibile solo su uscite in stato BOZZA.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string }> }
) {
  try {
    const { id: outingId, pid: participantId } = await params;
    const auth = await getAuth();
    if (!auth?.isStaff) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const supabase = await createClient();

    const { data: outing, error: outErr } = await supabase
      .from('outings')
      .select('status')
      .eq('id', outingId)
      .single();
    if (outErr || !outing) {
      return NextResponse.json({ error: 'Uscita non trovata' }, { status: 404 });
    }
    if (outing.status !== 'bozza') {
      return NextResponse.json(
        { error: 'Per rimuovere partecipanti l\'uscita deve essere in BOZZA' },
        { status: 409 }
      );
    }

    const { data: participant } = await supabase
      .from('outing_participants')
      .select('outing_id')
      .eq('id', participantId)
      .single();
    if (!participant || participant.outing_id !== outingId) {
      return NextResponse.json({ error: 'Partecipante non trovato' }, { status: 404 });
    }

    const { error } = await supabase
      .from('outing_participants')
      .delete()
      .eq('id', participantId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}
