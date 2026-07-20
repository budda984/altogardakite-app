import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';
import { createClient } from '@/lib/supabase/server';
import { spingiPush } from '@/lib/spingiPush';

// Accetta o rifiuta una richiesta arrivata dal portale soci.
//
// Nessuna logica qui dentro: rispondi_richiesta() fa tutto in una
// transazione sola — cambia lo stato della prenotazione E scrive l'avviso
// al socio. Se fossero due passaggi separati, prima o poi uno dei due si
// dimentica e il socio resta a guardare un'app che non gli ha detto niente.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const auth = await getAuth();
  if (!auth || !auth.isStaff) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  let body: { accetta?: boolean; motivo?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Richiesta malformata' }, { status: 400 });
  }

  if (typeof body.accetta !== 'boolean') {
    return NextResponse.json({ error: 'Azione non valida' }, { status: 400 });
  }

  const supabase = await createClient();

  // Prima leggiamo chi e' cosa: serve per il log, e dopo la risposta la
  // richiesta sparisce dalla vista.
  const { data: prima } = await supabase
    .from('bookings_da_rispondere')
    .select('first_name, last_name, booking_date, fascia, member_id')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.rpc('rispondi_richiesta', {
    p_booking_id: id,
    p_accetta: body.accetta,
    p_motivo: body.motivo?.trim() || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (prima) {
    const chi = `${prima.first_name} ${prima.last_name}`;
    await logActivity(
      supabase,
      auth,
      body.accetta ? 'booking.accept' : 'booking.refuse',
      body.accetta
        ? `Accettata la richiesta di ${chi} per il ${prima.booking_date} (${prima.fascia})`
        : `Rifiutata la richiesta di ${chi} per il ${prima.booking_date} (${prima.fascia})` +
          (body.motivo ? `: ${body.motivo}` : ''),
      { booking_id: id, member_id: prima.member_id }
    );
  }

  // L'avviso al socio e' stato scritto: sveglia subito le push.
  await spingiPush();

  return NextResponse.json({ ok: true });
}
