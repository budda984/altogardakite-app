import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';
import { createBookingSchema } from '@/lib/validation/booking-schemas';

/**
 * GET /api/bookings?date=YYYY-MM-DD
 * Restituisce le prenotazioni del giorno (tutti gli stati di default)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth?.isStaff) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const date = sp.get('date');
    if (!date) {
      return NextResponse.json({ error: 'Parametro date obbligatorio' }, { status: 400 });
    }

    const includeAll = sp.get('include_all') === 'true';

    const supabase = await createClient();
    let query = supabase
      .from('bookings_with_member')
      .select('*')
      .eq('booking_date', date)
      .order('first_name', { ascending: true });

    if (!includeAll) {
      query = query.eq('status', 'pending');
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ bookings: data || [] });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bookings
 * Crea una prenotazione
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth?.isStaff) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createBookingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const data = parsed.data;

    // Controllo: il socio non deve essere sostenitore (non puo partecipare)
    const { data: member, error: memberErr } = await supabase
      .from('members')
      .select('id, member_type, active, first_name, last_name')
      .eq('id', data.member_id)
      .single();
    if (memberErr || !member) {
      return NextResponse.json({ error: 'Socio non trovato' }, { status: 404 });
    }
    if (!member.active) {
      return NextResponse.json(
        { error: `${member.first_name} ${member.last_name} non e attivo` },
        { status: 400 }
      );
    }
    if (member.member_type === 'sostenitore') {
      return NextResponse.json(
        { error: 'I soci sostenitori non possono partecipare a uscite' },
        { status: 400 }
      );
    }

    // Verifica che non esista gia' una prenotazione pending per questo socio
    // sullo stesso giorno/slot
    const { data: existing } = await supabase
      .from('bookings')
      .select('id')
      .eq('member_id', data.member_id)
      .eq('booking_date', data.booking_date)
      .eq('session_template_id', data.session_template_id)
      .eq('status', 'pending')
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { error: 'Prenotazione gia esistente per questo socio in questo slot' },
        { status: 409 }
      );
    }

    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        member_id: data.member_id,
        booking_date: data.booking_date,
        session_template_id: data.session_template_id,
        preferred_discipline: data.preferred_discipline || null,
        participation_type: data.participation_type,
        notes: data.notes || null,
        status: 'pending',
        created_by: auth.userId,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log attivita (best effort)
    const { data: logMember } = await supabase
      .from('members').select('first_name, last_name').eq('id', data.member_id).single();
    const { data: tpl } = await supabase
      .from('session_templates').select('name').eq('id', data.session_template_id).single();
    await logActivity(supabase, auth, 'booking.create',
      `Prenotazione: ${logMember ? `${logMember.first_name} ${logMember.last_name}` : 'socio'} — ${tpl?.name || 'sessione'} del ${data.booking_date}`,
      { booking_id: booking.id, member_id: data.member_id, date: data.booking_date });

    return NextResponse.json(booking);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}
