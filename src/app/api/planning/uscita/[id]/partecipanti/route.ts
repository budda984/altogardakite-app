import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';
import { z } from 'zod';

// Versione semplificata: solo dati di base, niente billing immediato.
// Gli addebiti partono alla chiusura dell'uscita.
const addParticipantSchema = z.object({
  member_id: z.string().uuid('Socio obbligatorio'),
  participation_type: z.enum(['corso', 'lift_supervisionato', 'lift_semplice']).default('lift_semplice'),
  rental_type: z.enum([
    'nessuno', 'completo', 'solo_tavola', 'solo_kite', 'solo_barra',
    'solo_trapezio', 'solo_muta', 'solo_giubbotto', 'wing_completo', 'altro',
  ]).default('nessuno'),
  rental_charge_amount: z.coerce.number().min(0).nullable().optional(),
  notes: z.string().optional().or(z.literal('')),
});

export async function POST(
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
    const parsed = addParticipantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const data = parsed.data;

    // Verifica che l'uscita sia in bozza
    const { data: outing, error: outErr } = await supabase
      .from('outings')
      .select('id, status')
      .eq('id', outingId)
      .single();
    if (outErr || !outing) {
      return NextResponse.json({ error: 'Uscita non trovata' }, { status: 404 });
    }
    if (outing.status === 'chiusa') {
      return NextResponse.json(
        { error: 'L\'uscita e stata chiusa. Riaprila per modificare i partecipanti.' },
        { status: 409 }
      );
    }

    const { data: participant, error: pErr } = await supabase
      .from('outing_participants')
      .insert({
        outing_id: outingId,
        member_id: data.member_id,
        participation_type: data.participation_type,
        rental_type: data.rental_type,
        rental_charge_amount: data.rental_charge_amount ?? null,
        notes: data.notes || null,
      })
      .select()
      .single();

    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    return NextResponse.json(participant, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: outingId } = await params;
    const participantId = request.nextUrl.searchParams.get('participant_id');
    if (!participantId) {
      return NextResponse.json({ error: 'participant_id richiesto' }, { status: 400 });
    }

    const auth = await getAuth();
    if (!auth?.isStaff) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const supabase = await createClient();

    // Verifica stato uscita
    const { data: outing } = await supabase
      .from('outings')
      .select('status')
      .eq('id', outingId)
      .single();

    if (outing?.status === 'chiusa') {
      return NextResponse.json(
        { error: 'L\'uscita e chiusa. Riaprila prima di rimuovere partecipanti.' },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from('outing_participants')
      .delete()
      .eq('id', participantId)
      .eq('outing_id', outingId);

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
