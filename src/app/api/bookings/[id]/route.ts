import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';

/**
 * DELETE /api/bookings/[id] - cancella una prenotazione (solo se pending)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await params;
    const auth = await getAuth();
    if (!auth?.isStaff) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const supabase = await createClient();

    // Verifica stato
    const { data: booking, error: getErr } = await supabase
      .from('bookings')
      .select('status')
      .eq('id', bookingId)
      .single();
    if (getErr || !booking) {
      return NextResponse.json({ error: 'Prenotazione non trovata' }, { status: 404 });
    }
    if (booking.status !== 'pending') {
      return NextResponse.json(
        { error: 'Solo le prenotazioni pending possono essere cancellate' },
        { status: 409 }
      );
    }

    const { error } = await supabase.from('bookings').delete().eq('id', bookingId);
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
