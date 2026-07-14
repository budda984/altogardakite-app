import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';
import { z } from 'zod';

/**
 * GET /api/planning/assenze?date=YYYY-MM-DD
 * Assenze istruttori del giorno, con nome istruttore.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth?.isStaff) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const date = request.nextUrl.searchParams.get('date');
    if (!date) {
      return NextResponse.json({ error: 'date richiesta' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('instructor_absences')
      .select(`
        id, instructor_id, absence_date, session_template_id, notes,
        instructor:instructors(id, first_name, last_name)
      `)
      .eq('absence_date', date)
      .order('created_at');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ absences: data || [] });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}

const createSchema = z.object({
  instructor_id: z.string().uuid(),
  absence_date: z.string().min(1),
  session_template_id: z.string().uuid().nullable().optional(),
  notes: z.string().optional().or(z.literal('')),
});

/**
 * POST /api/planning/assenze
 * Segnala un'assenza (giorno intero se session_template_id assente/null).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth?.isStaff) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dati non validi' }, { status: 400 });
    }

    const { instructor_id, absence_date, session_template_id, notes } = parsed.data;
    const supabase = await createClient();

    // Evita duplicati identici
    let dupQuery = supabase
      .from('instructor_absences')
      .select('id')
      .eq('instructor_id', instructor_id)
      .eq('absence_date', absence_date);
    dupQuery = session_template_id
      ? dupQuery.eq('session_template_id', session_template_id)
      : dupQuery.is('session_template_id', null);
    const { data: existing } = await dupQuery.maybeSingle();
    if (existing) {
      return NextResponse.json({ error: 'Assenza gia segnalata' }, { status: 409 });
    }

    const { error } = await supabase.from('instructor_absences').insert({
      instructor_id,
      absence_date,
      session_template_id: session_template_id || null,
      notes: notes || null,
      created_by: auth.userId,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: ins } = await supabase
      .from('instructors').select('first_name, last_name').eq('id', instructor_id).single();
    let tplName: string | null = null;
    if (session_template_id) {
      const { data: tpl } = await supabase
        .from('session_templates').select('name').eq('id', session_template_id).single();
      tplName = tpl?.name || null;
    }
    await logActivity(supabase, auth, 'absence.create',
      `Assenza segnalata: ${ins ? `${ins.first_name} ${ins.last_name}` : 'istruttore'} il ${absence_date}${tplName ? ` (${tplName})` : ' (giorno intero)'}`,
      { instructor_id, date: absence_date });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore server' },
      { status: 500 }
    );
  }
}
