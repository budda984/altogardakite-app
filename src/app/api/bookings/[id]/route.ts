import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';

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

    // Verifica stato (e recupera dettagli per il log)
    const { data: booking, error: getErr } = await supabase
      .from('bookings_with_member')
      .select('status, first_name, last_name, booking_date, template_name')
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

    await logActivity(supabase, auth, 'booking.delete',
      `Prenotazione cancellata: ${booking.first_name} ${booking.last_name} — ${booking.template_name} del ${booking.booking_date}`,
      { booking_id: bookingId });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/bookings/[id] - sposta una prenotazione da/verso lista d'attesa
 * Body: { is_waitlist: boolean }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await params;
    const auth = await getAuth();
    if (!auth?.isStaff) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const body = await request.json();
    if (typeof body.is_waitlist !== 'boolean') {
      return NextResponse.json({ error: 'is_waitlist mancante' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: booking } = await supabase
      .from('bookings_with_member')
      .select('status, first_name, last_name, booking_date, template_name')
      .eq('id', bookingId)
      .single();
    if (!booking) {
      return NextResponse.json({ error: 'Prenotazione non trovata' }, { status: 404 });
    }
    if (booking.status !== 'pending') {
      return NextResponse.json(
        { error: 'Solo le prenotazioni non ancora assegnate possono essere spostate' },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from('bookings')
      .update({ is_waitlist: body.is_waitlist })
      .eq('id', bookingId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logActivity(supabase, auth, 'booking.waitlist',
      `${booking.first_name} ${booking.last_name} ${body.is_waitlist ? 'messo in lista d\'attesa' : 'confermato dalla lista d\'attesa'} — ${booking.template_name} del ${booking.booking_date}`,
      { booking_id: bookingId, is_waitlist: body.is_waitlist });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}
