import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';

/**
 * GET /api/report?type=X&from=YYYY-MM-DD&to=YYYY-MM-DD&id=XXX
 *
 * type:
 *   - season       : riassunto generale del periodo
 *   - member       : statistiche del singolo socio (richiede id)
 *   - boat         : statistiche della singola barca (richiede id)
 *   - instructor   : statistiche del singolo istruttore (richiede id)
 *   - day          : tutte le sessioni di un singolo giorno (from = to = data)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth?.isStaff) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const type = sp.get('type') || 'season';
    const from = sp.get('from');
    const to = sp.get('to');
    const id = sp.get('id');

    if (!from || !to) {
      return NextResponse.json({ error: 'Parametri from e to obbligatori' }, { status: 400 });
    }

    const supabase = await createClient();

    if (type === 'season') {
      return await reportSeason(supabase, from, to);
    }
    if (type === 'member') {
      if (!id) return NextResponse.json({ error: 'id socio obbligatorio' }, { status: 400 });
      return await reportMember(supabase, id, from, to);
    }
    if (type === 'boat') {
      if (!id) return NextResponse.json({ error: 'id barca obbligatorio' }, { status: 400 });
      return await reportBoat(supabase, id, from, to);
    }
    if (type === 'instructor') {
      if (!id) return NextResponse.json({ error: 'id istruttore obbligatorio' }, { status: 400 });
      return await reportInstructor(supabase, id, from, to);
    }
    if (type === 'day') {
      return await reportDay(supabase, from);
    }
    return NextResponse.json({ error: 'Tipo report non valido' }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}

type SB = Awaited<ReturnType<typeof createClient>>;

async function reportSeason(supabase: SB, from: string, to: string) {
  const [outingsRes, movementsRes, membersRes, paymentsByMethodRes] = await Promise.all([
    supabase.from('outings').select('id, status, outing_date, discipline, boat_id, boats(name)')
      .gte('outing_date', from).lte('outing_date', to),
    supabase.from('movements').select('amount, paid, movement_type, lift_discipline, movement_date')
      .eq('is_reversed', false)
      .gte('movement_date', from).lte('movement_date', to + 'T23:59:59'),
    supabase.from('members').select('id', { count: 'exact', head: true }).eq('active', true),
    supabase.from('movements').select('amount, payment_method')
      .eq('is_reversed', false).eq('paid', true).gt('amount', 0)
      .gte('movement_date', from).lte('movement_date', to + 'T23:59:59'),
  ]);

  const outings = outingsRes.data || [];
  const movements = movementsRes.data || [];
  const payments = paymentsByMethodRes.data || [];

  // Statistiche uscite
  const outingsTotal = outings.length;
  const outingsClosed = outings.filter((o) => o.status === 'chiusa').length;
  const outingsCancelled = outings.filter((o) => o.status === 'annullata').length;
  const outingsDraft = outings.filter((o) => o.status === 'bozza').length;

  // Per disciplina
  const byDiscipline: Record<string, number> = {};
  outings.forEach((o) => {
    const d = o.discipline || 'altro';
    byDiscipline[d] = (byDiscipline[d] || 0) + 1;
  });

  // Per barca
  const byBoat: Record<string, { name: string; count: number }> = {};
  outings.forEach((o) => {
    if (!o.boat_id) return;
    const boatRel = o.boats as { name: string } | { name: string }[] | null;
    const name = Array.isArray(boatRel) ? boatRel[0]?.name : boatRel?.name;
    if (!byBoat[o.boat_id]) byBoat[o.boat_id] = { name: name || '?', count: 0 };
    byBoat[o.boat_id].count += 1;
  });

  // Cash flow
  const incomeReceived = movements
    .filter((m) => Number(m.amount) > 0 && m.paid)
    .reduce((sum, m) => sum + Number(m.amount), 0);
  const outstanding = movements
    .filter((m) => Number(m.amount) < 0 && !m.paid)
    .reduce((sum, m) => sum + (-Number(m.amount)), 0);

  // Per metodo pagamento
  const byMethod: Record<string, number> = {};
  payments.forEach((p) => {
    const m = p.payment_method || 'altro';
    byMethod[m] = (byMethod[m] || 0) + Number(p.amount);
  });

  return NextResponse.json({
    type: 'season',
    period: { from, to },
    outings: {
      total: outingsTotal,
      closed: outingsClosed,
      cancelled: outingsCancelled,
      draft: outingsDraft,
      by_discipline: byDiscipline,
      by_boat: Object.values(byBoat).sort((a, b) => b.count - a.count),
    },
    cashflow: {
      income_received: incomeReceived,
      outstanding,
      by_payment_method: byMethod,
    },
    members_active: membersRes.count || 0,
  });
}

async function reportMember(supabase: SB, memberId: string, from: string, to: string) {
  const [memberRes, participationsRes, movementsRes, packagesRes, subsRes] = await Promise.all([
    supabase.from('members').select('*').eq('id', memberId).single(),
    supabase.from('outing_participants')
      .select(`
        id, participation_type, rental_type,
        outings!inner(id, outing_date, discipline, status, boat:boats(name))
      `)
      .eq('member_id', memberId)
      .gte('outings.outing_date', from).lte('outings.outing_date', to),
    supabase.from('movements')
      .select('*')
      .eq('member_id', memberId)
      .eq('is_reversed', false)
      .gte('movement_date', from).lte('movement_date', to + 'T23:59:59')
      .order('movement_date', { ascending: true }),
    supabase.from('packages')
      .select('*')
      .eq('member_id', memberId)
      .gte('created_at', from).lte('created_at', to + 'T23:59:59'),
    supabase.from('member_active_subscriptions')
      .select('*')
      .eq('member_id', memberId),
  ]);

  if (!memberRes.data) {
    return NextResponse.json({ error: 'Socio non trovato' }, { status: 404 });
  }

  const movements = movementsRes.data || [];
  const totalPaid = movements
    .filter((m) => Number(m.amount) > 0 && m.paid)
    .reduce((sum, m) => sum + Number(m.amount), 0);
  const totalDue = movements
    .filter((m) => Number(m.amount) < 0 && !m.paid)
    .reduce((sum, m) => sum + (-Number(m.amount)), 0);
  const liftConsumed = movements
    .filter((m) => Number(m.lift_delta) === -1)
    .length;

  return NextResponse.json({
    type: 'member',
    period: { from, to },
    member: memberRes.data,
    participations: participationsRes.data || [],
    movements,
    packages: packagesRes.data || [],
    active_subscriptions: subsRes.data || [],
    summary: {
      total_paid: totalPaid,
      total_outstanding: totalDue,
      lifts_consumed: liftConsumed,
      participations_count: (participationsRes.data || []).length,
    },
  });
}

async function reportBoat(supabase: SB, boatId: string, from: string, to: string) {
  const [boatRes, outingsRes] = await Promise.all([
    supabase.from('boats').select('*').eq('id', boatId).single(),
    supabase.from('outings')
      .select(`
        id, outing_date, status, discipline,
        departure_time, return_time, weather_notes,
        outing_participants(id, member:members(first_name, last_name)),
        outing_instructors(instructor:instructors(first_name, last_name))
      `)
      .eq('boat_id', boatId)
      .gte('outing_date', from).lte('outing_date', to)
      .order('outing_date'),
  ]);

  if (!boatRes.data) {
    return NextResponse.json({ error: 'Barca non trovata' }, { status: 404 });
  }

  const outings = outingsRes.data || [];
  const closed = outings.filter((o) => o.status === 'chiusa').length;
  const cancelled = outings.filter((o) => o.status === 'annullata').length;
  const totalParticipants = outings.reduce(
    (sum, o) => sum + (o.outing_participants?.length || 0), 0
  );

  // Calcolo ore
  let totalMinutes = 0;
  outings.forEach((o) => {
    if (o.status !== 'chiusa') return;
    if (!o.departure_time || !o.return_time) return;
    const [dh, dm] = o.departure_time.split(':').map(Number);
    const [rh, rm] = o.return_time.split(':').map(Number);
    totalMinutes += (rh * 60 + rm) - (dh * 60 + dm);
  });

  // Movimenti per uscite di questa barca
  const outingIds = outings.map((o) => o.id);
  let revenue = 0;
  if (outingIds.length > 0) {
    const { data: movs } = await supabase
      .from('movements')
      .select('amount')
      .in('outing_id', outingIds)
      .eq('is_reversed', false)
      .eq('paid', true)
      .gt('amount', 0);
    revenue = (movs || []).reduce((sum, m) => sum + Number(m.amount), 0);
  }

  return NextResponse.json({
    type: 'boat',
    period: { from, to },
    boat: boatRes.data,
    outings,
    summary: {
      total_outings: outings.length,
      closed,
      cancelled,
      total_participants: totalParticipants,
      total_hours: Math.round(totalMinutes / 60 * 10) / 10,
      revenue_generated: revenue,
    },
  });
}

async function reportInstructor(supabase: SB, instructorId: string, from: string, to: string) {
  const [instRes, assignmentsRes] = await Promise.all([
    supabase.from('instructors').select('*').eq('id', instructorId).single(),
    supabase.from('outing_instructors')
      .select(`
        outing_id,
        role,
        outings!inner(
          id, outing_date, status, discipline,
          departure_time, return_time, weather_notes,
          boat:boats(name),
          outing_participants(id, member:members(first_name, last_name))
        )
      `)
      .eq('instructor_id', instructorId)
      .gte('outings.outing_date', from)
      .lte('outings.outing_date', to),
  ]);

  if (!instRes.data) {
    return NextResponse.json({ error: 'Istruttore non trovato' }, { status: 404 });
  }

  const assignments = assignmentsRes.data || [];

  // Estrai uscite dalle assegnazioni
  type OutingFromAssignment = {
    id: string; outing_date: string; status: string; discipline: string | null;
    departure_time: string | null; return_time: string | null;
    weather_notes: string | null;
    boat: { name: string } | { name: string }[] | null;
    outing_participants: { id: string; member: unknown }[];
  };
  const outings = assignments.map((a) => {
    const o = a.outings as unknown as OutingFromAssignment;
    return { ...o, role_in_outing: a.role };
  });

  const closed = outings.filter((o) => o.status === 'chiusa').length;
  const cancelled = outings.filter((o) => o.status === 'annullata').length;
  const totalParticipants = outings.reduce(
    (sum, o) => sum + (o.outing_participants?.length || 0), 0
  );

  let totalMinutes = 0;
  outings.forEach((o) => {
    if (o.status !== 'chiusa') return;
    if (!o.departure_time || !o.return_time) return;
    const [dh, dm] = o.departure_time.split(':').map(Number);
    const [rh, rm] = o.return_time.split(':').map(Number);
    totalMinutes += (rh * 60 + rm) - (dh * 60 + dm);
  });

  return NextResponse.json({
    type: 'instructor',
    period: { from, to },
    instructor: instRes.data,
    outings,
    summary: {
      total_outings: outings.length,
      closed,
      cancelled,
      total_participants: totalParticipants,
      total_hours: Math.round(totalMinutes / 60 * 10) / 10,
    },
  });
}

async function reportDay(supabase: SB, date: string) {
  const { data: outings } = await supabase
    .from('outings')
    .select(`
      id, outing_date, status, discipline, wind_session,
      departure_time, return_time, weather_notes, notes,
      cancellation_reason,
      boat:boats(name, capacity),
      outing_instructors(instructor:instructors(first_name, last_name)),
      outing_participants(
        id, participation_type, rental_type,
        member:members(first_name, last_name, membership_number)
      )
    `)
    .eq('outing_date', date)
    .order('departure_time');

  return NextResponse.json({
    type: 'day',
    period: { from: date, to: date },
    outings: outings || [],
  });
}
